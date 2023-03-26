import path from 'path'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import { pki } from '@dugrema/node-forge'
import { base64 } from 'multiformats/bases/base64'

import { getAcceptedFileReader, streamAsyncIterable } from './stream.js'
import { chiffrage }  from './chiffrage'
import * as hachage from './hachage'

const { preparerCipher, preparerCommandeMaitrecles } = chiffrage

// Globals
// Structure uploads : {file: AcceptedFile, status=1, }
var _uploadsPending = [],
    _uploadEnCours = null,
    _uploadsCompletes = []

// Callback etat : (nbFichiersPending, pctFichierEnCours, {encours: uuid, complete: uuid})
var _callbackEtatUpload = null,
    _publicKeyCa = null,
    _fingerprintCa = null,
    _certificats = null,
    _domaine = 'GrosFichiers',
    _pathServeur = new URL(self.location.href)

_pathServeur.pathname = '/collections/fichiers'

const THRESHOLD_256kb = 5 * 1024 * 1024,
      THRESHOLD_512kb = 20 * 1024 * 1024,
      THRESHOLD_1mb = 50 * 1024 * 1024,
      THRESHOLD_2mb = 100 * 1024 * 1024

// Retourne la taille a utiliser pour les batch
function getUploadBatchSize(fileSize) {
    if(isNaN(fileSize)) throw new Error("NaN")
    if(fileSize < THRESHOLD_256kb) return 256 * 1024
    if(fileSize < THRESHOLD_512kb) return 512 * 1024
    if(fileSize < THRESHOLD_1mb) return 1024 * 1024
    if(fileSize < THRESHOLD_2mb) return 2 * 1024 * 1024
    return 5 * 1024 * 1024
}

// const UPLOAD_BATCH_SIZE = 5 * 1024 * 1024,  // 5 MB
//       CONST_BUFFER_CHIFFRAGE = 64 * 1024
const STATUS_NOUVEAU = 1,
      STATUS_ENCOURS = 2,
      STATUS_SUCCES = 3,
      STATUS_ERREUR = 4,
      STATUS_NONCONFIRME = 5

const ETAT_PREPARATION = 1,
      ETAT_PRET = 2

export function up_setPathServeur(pathServeur) {
    if(pathServeur.startsWith('https://')) {
        _pathServeur = new URL(pathServeur)
    } else {
        const pathServeurUrl = new URL(self.location.href)
        pathServeurUrl.pathname = pathServeur
        _pathServeur = pathServeurUrl
    }
    console.debug("Path serveur : ", _pathServeur.href)
}
    
export function up_getEtatCourant() {

    const loadedCourant = _uploadEnCours?_uploadEnCours.position:0

    const totalBytes = [..._uploadsPending, _uploadEnCours, ..._uploadsCompletes].reduce((total, item)=>{
        if(!item) return total
        return total + item.size
    }, 0)
    const loadedBytes = _uploadsCompletes.reduce((total, item)=>{
        return total + item.size
    }, loadedCourant)

    const pctTotal = Math.floor(loadedBytes * 100 / totalBytes)

    const etat = {
        uploadsPending: _uploadsPending.map(filtrerEntreeFichier),
        uploadEnCours: filtrerEntreeFichier(_uploadEnCours),
        uploadsCompletes: _uploadsCompletes.map(filtrerEntreeFichier),
        totalBytes, loadedBytes, pctTotal,
    }
    // console.debug("Retourner etat : %O", etat)
    return etat
}

function filtrerEntreeFichier(entree) {
    if(!entree) return null
    const entreeCopy = {...entree}
    delete entreeCopy.file
    delete entreeCopy.cancelTokenSource
    return entreeCopy
}

function mapAcceptedFile(file) {
    let dateFichier = null
    try {
        dateFichier = Math.floor(file.lastModified / 1000)
    } catch(err) {
        console.warn("Erreur chargement date fichier : %O", err)
    }

    const nom = file.name.normalize()

    const transaction = {
        nom,  // iOS utilise la forme decomposee (combining)
        mimetype: file.type || 'application/octet-stream',
        taille: file.size,
        dateFichier,
    }
    
    const infoUpload = {
        nom,
        file: file.object,
        size: file.size,
        correlation: uuidv4(),
        transaction,
    }

    return infoUpload
}

/** Retourne un StreamReader qui applique les transformations requises */
async function preparerTransform() {
    return preparerCipher({clePubliqueEd25519: _publicKeyCa})
}

async function emettreEtat(flags) {
    flags = flags || {}
    if(_callbackEtatUpload) {
        // console.debug("Emettre etat")

        // const flags = {}
        let pctFichierEnCours = 0
        if(_uploadEnCours) {
            flags.encours = _uploadEnCours.correlation
            const size = isNaN(_uploadEnCours.size)?0:_uploadEnCours.size
            const position = isNaN(_uploadEnCours.position)?0:_uploadEnCours.position
            const batchLoaded = isNaN(_uploadEnCours.batchLoaded)?0:_uploadEnCours.batchLoaded
            const courant = position + batchLoaded
            if(courant <= size) {
                pctFichierEnCours = Math.floor(courant/size*100)
            } else {
                // Erreur, on set pctFichierEnCours si disponible
                pctFichierEnCours = _uploadEnCours.pctFichierEnCours || 0
            }
        }

        _callbackEtatUpload(
            _uploadsPending.length, 
            pctFichierEnCours, 
            flags,
        )
    }
}

export function up_setCallbackUpload(cb) {
    _callbackEtatUpload = cb
}

export function up_setCertificatCa(certificat) {
    // _certificatCa = certificat
    const cert = pki.certificateFromPem(certificat)
    _publicKeyCa = cert.publicKey.publicKeyBytes
    hachage.hacherCertificat(cert)
        .then(fingerprint=>{
            _fingerprintCa = fingerprint
            // console.debug("Fingerprint certificat CA : %s", fingerprint)
        })
        .catch(err=>console.error("Erreur calcul fingerprint CA : %O", err))
    // console.debug("Cle CA chargee : %O, cle : %O", cert, _publicKeyCa)
}

export function up_setCertificats(certificats) {
    if( ! Array.isArray(certificats) ) {
        throw new Error(`Certificats de mauvais type (pas Array) : ${certificats}`)
    }
    _certificats = certificats
}

export function up_setDomaine(domaine) {
    _domaine = domaine
}

export function up_clearCompletes(opts) {
    opts = opts || {}
    const {status, correlation} = opts
    // console.debug(Clear completes : %O", opts)
    if(correlation) {
        const nouvelleListe = _uploadsCompletes.filter(item=>item.correlation!==correlation)
        _uploadsCompletes = nouvelleListe
    } else if(status) {
        const nouvelleListe = _uploadsCompletes.filter(item=>item.status!==status)
        _uploadsCompletes = nouvelleListe
    } else {
        _uploadsCompletes = []
    }

    emettreEtat()
}

export function up_retryErreur(opts) {
    opts = opts || {}
    const correlation = opts.correlation
    const correlationsRetry = []
    
    let critere = null
    if(correlation) {
        // console.debug("Retry correlation %s", correlation)
        critere = item => item.correlation === correlation
    } else {
        // Defaut, en erreur seulement (4)
        // console.debug("Filtre erreur (status 4) de %O", _uploadsCompletes)
        critere = item => {
            // console.debug("Comparer item %O", item)
            return item.status === 4
        }
    }

    _uploadsCompletes
        .filter(critere)
        .forEach(item=>{
            correlationsRetry.push(item.correlation)
            const updatedItem = {
                ...item, 
                complete: false, 
                status: 1, position: 0, 
                batchLoaded: 0, pctBatchProgres: 0,
            }
            // console.debug("Resoumettre %O", updatedItem)
            _uploadsPending.push(updatedItem)
        })

    const completes = _uploadsCompletes.filter(item=>!correlationsRetry.includes(item.correlation))
    // console.debug("Update liste completes: %O", completes)
    _uploadsCompletes = completes
    emettreEtat()
    traiterUploads()  // Demarrer traitement si pas deja en cours
}

async function conserverFichier(file, fileMappe, params, fcts) {

    const tailleTotale = params.tailleTotale || file.size
    const { ajouterPart, setProgres, signalAnnuler } = fcts
    const { size } = fileMappe
    const { correlation } = params

    // Preparer chiffrage
    const hachageDechiffre = new hachage.Hacheur({hashingCode: 'blake2b-512'})
    const transformInst = await preparerTransform()
    const transform = {
        update: async chunk => {
            await hachageDechiffre.update(chunk)
            return await transformInst.cipher.update(chunk)
        },
        finalize: async () => {
            return await transformInst.cipher.finalize()
        },
        etatFinal: transformInst.cipher.etatFinal,
    }
        
    console.debug("traiterAcceptedFiles Transform : ", transformInst)

    const batchSize = getUploadBatchSize(size)
    const reader = getAcceptedFileReader(file)
    const iterReader = streamAsyncIterable(reader, {batchSize, transform})

    const frequenceUpdate = 500
    let dernierUpdate = 0,
        compteurPosition = 0,
        taillePreparee = 0

    for await (const chunk of iterReader) {
        if(await signalAnnuler()) throw new Error("Cancelled")

        // Conserver dans idb
        if(ajouterPart) await ajouterPart(correlation, compteurPosition, chunk)
        compteurPosition += chunk.length

        taillePreparee += chunk.length
        const now = new Date().getTime()
        if(setProgres) {
            if(dernierUpdate + frequenceUpdate < now) {
                dernierUpdate = now
                setProgres(Math.floor(100*taillePreparee/tailleTotale))
            }
        }
    }

    const etatFinalChiffrage = transform.etatFinal()
    etatFinalChiffrage.secretChiffre = transformInst.secretChiffre
    etatFinalChiffrage.hachage_original = await hachageDechiffre.finalize()
    console.debug("Etat final chiffrage : ", etatFinalChiffrage)
    return etatFinalChiffrage
}

async function formatterDocIdb(docIdb, infoChiffrage) {
    const champsOptionnels = ['iv', 'nonce', 'header', 'tag']
    const paramsChiffrage = champsOptionnels.reduce((acc, champ)=>{
        const valeur = infoChiffrage[champ]
        if(valeur) acc[champ] = valeur
        return acc
    }, {})

    const hachage_bytes = infoChiffrage.hachage,
          secretKey = infoChiffrage.key

    // Ajouter fuuid a la transaction GrosFichiers
    docIdb.transactionGrosfichiers.fuuid = hachage_bytes

    // Chiffrer champs de metadonnees
    const transactionGrosfichiers = docIdb.transactionGrosfichiers
    const listeChamps = ['nom', 'dateFichier']
    const metadataDechiffre = {
        hachage_original: infoChiffrage.hachage_original,
    }
    docIdb.metadataDechiffre = metadataDechiffre
    for (const champ of listeChamps) {
        const value = transactionGrosfichiers[champ]
        if(value) metadataDechiffre[champ] = value
        delete transactionGrosfichiers[champ]
    }
    console.debug("formatterDocIdb Champs a chiffrer ", metadataDechiffre)
    const champsChiffres = await chiffrage.updateChampsChiffres(metadataDechiffre, secretKey)
    transactionGrosfichiers.metadata = champsChiffres

    // console.debug("Resultat chiffrage : %O", etatFinalChiffrage)
    if(_fingerprintCa && infoChiffrage.secretChiffre) {
        // Creer la commande de maitre des cles, chiffrer les cles
        const identificateurs_document = { fuuid: hachage_bytes }
        const certificats = _certificats.map(item=>item[0])  // Conserver les certificats maitredescles (pas chaine)

        docIdb.transactionMaitredescles = await preparerCommandeMaitrecles(
            certificats, 
            secretKey, 
            _domaine, 
            hachage_bytes, 
            identificateurs_document, 
            {...paramsChiffrage, DEBUG: false}
        )
        docIdb.transactionMaitredescles.cles[_fingerprintCa] = infoChiffrage.secretChiffre
    } else {
        // Conserver la cle secrete directement (attention : le contenu du message devra etre chiffre)
        const informationCle = {
            hachage_bytes: infoChiffrage.hachage,
            format: infoChiffrage.format,
            header: infoChiffrage.header,
            cleSecrete: base64.encode(secretKey),
        }
        docIdb.cle = informationCle
    }

    docIdb.etat = ETAT_PRET
    // docIdb.taille = compteurPosition
    if(docIdb.taille !== infoChiffrage.taille) docIdb.taille_chiffree = infoChiffrage.taille
    
    return docIdb
}

async function traiterFichier(file, tailleTotale, params, fcts) {
    fcts = fcts || {}
    const { signalAnnuler } = fcts    
    if(signalAnnuler && await signalAnnuler()) throw new Error("Cancelled")

    const now = new Date().getTime()
    const { userId, cuuid, token } = params
    const { updateFichier } = fcts

    let demarrer = true
    if(params.demarrer !== undefined) demarrer = params.demarrer

    // Preparer fichier
    const fileMappe = mapAcceptedFile(file)
    fileMappe.transaction.cuuid = cuuid
    // console.debug("File mappe : ", fileMappe)
    const fileSize = fileMappe.size

    const correlation = '' + uuidv4()

    const docIdb = {
        // PK
        correlation, userId, token,

        // Metadata recue
        nom: fileMappe.nom || correlation,
        taille: fileSize, //fileMappe.size,
        mimetype: fileMappe.type || 'application/octet-stream',

        // Etat initial
        etat: ETAT_PREPARATION, 
        positionsCompletees: [],
        tailleCompletee: 0,
        dateCreation: now,
        retryCount: -1,  // Incremente sur chaque debut d'upload
        transactionGrosfichiers: fileMappe.transaction,
        transactionMaitredescles: null,
    }

    // console.debug("Update initial docIdb ", docIdb)
    if(updateFichier) await updateFichier(docIdb, {demarrer: false})
    
    try {
        const paramsConserver = {...params, correlation, tailleTotale}
        const etatFinalChiffrage = await conserverFichier(file, fileMappe, paramsConserver, fcts)
        
        const docIdbMaj = await formatterDocIdb(docIdb, etatFinalChiffrage)

        // Dispatch pour demarrer upload
        if(updateFichier) await updateFichier(docIdbMaj, {demarrer})

    } catch(err) {
        if(updateFichier) await updateFichier(docIdb, {err: ''+err})
        throw err
    }

    
}

/**
 * Upload de fichiers (v1 - obsolete).
 * @param {*} acceptedFiles 
 * @param {*} userId 
 * @param {*} cuuid 
 * @param {*} ajouterPart 
 * @param {*} updateFichier 
 * @param {*} setProgres 
 * @param {*} signalAnnuler 
 */
export async function traiterAcceptedFiles(acceptedFiles, userId, cuuid, ajouterPart, updateFichier, setProgres, signalAnnuler) {
    const params = { userId, cuuid }
    const fcts = { ajouterPart, updateFichier, setProgres, signalAnnuler }

    // console.debug("Accepted files ", acceptedFiles)
    let tailleTotale = 0
    for (const file of acceptedFiles) {
        tailleTotale += file.size
    }

    // console.debug("Preparation de %d bytes", tailleTotale)
    for await (const file of acceptedFiles) {
        await traiterFichier(file, tailleTotale, params, fcts)
    }
}

/**
 * Chiffre et commence l'upload de fichiers selectionnes dans le navigateur.
 * 
 * Note : les fonctions (e.g. ajouterPart) ne peuvent pas etre combinees dans un Object a cause de comlink
 * 
 * @param {*} params acceptedFiles, batchId, userId, cuuid, 
 * @param {*} ajouterPart 
 * @param {*} updateFichier 
 * @param {*} setProgres 
 * @param {*} signalAnnuler 
 */
export async function traiterAcceptedFilesV2(params, ajouterPart, updateFichier, setProgres, signalAnnuler) {
    const { acceptedFiles } = params
    const fcts = { ajouterPart, updateFichier, setProgres, signalAnnuler}

    // console.debug("Accepted files ", acceptedFiles)
    let tailleTotale = 0
    for (const file of acceptedFiles) {
        tailleTotale += file.size
    }

    // console.debug("Preparation de %d bytes", tailleTotale)
    for await (const file of acceptedFiles) {
        await traiterFichier(file, tailleTotale, params, fcts)
    }
}

var _cancelUploadToken = null

export function cancelUpload() {
    if(_cancelUploadToken) return _cancelUploadToken.cancel()
}

export async function partUploader(token, correlation, position, partContent, opts) {
    opts = opts || {}
    const onUploadProgress = opts.onUploadProgress

    const pathUploadUrl = new URL(_pathServeur.href + path.join('/'+correlation, ''+position))
    console.debug("partUploading pathUpload ", pathUploadUrl.href)
    const cancelTokenSource = axios.CancelToken.source()
    _cancelUploadToken = cancelTokenSource

    // console.debug("Cancel token source : ", cancelTokenSource)

    const reponse = await axios({
        url: pathUploadUrl.href,
        method: 'PUT',
        headers: { 
            'content-type': 'application/data', 
            'x-token-jwt': token,
        },
        data: partContent,
        onUploadProgress,
        cancelToken: cancelTokenSource.token,
      })
        .then(resultat=>{
            // console.debug("Resultat upload : ", resultat)
            return {status: resultat.status, data: resultat.data}
      })
        .finally( () => _cancelUploadToken = null )

    return reponse
}

export async function confirmerUpload(token, correlation, opts) {
    opts = opts || {}
    // console.debug("confirmerUpload %s cles : %O, transaction : %O", correlation, cles, transaction)
    const { transaction } = opts
    const cles = opts.cles || transaction?transaction['_cles']:null

    let hachage = opts.hachage
    if(!hachage) {
        if(cles) hachage = cles.hachage
        else if(transaction) hachage = transaction.fuuid
    }
    if(!hachage) throw new Error("Hachage fichier manquant")

    const confirmationResultat = { etat: {correlation, hachage} }
    if(transaction) confirmationResultat.transaction = transaction
    if(cles) confirmationResultat.cles = cles
    const pathConfirmation = _pathServeur.href + path.join('/' + correlation)
    const reponse = await axios({
        method: 'POST', 
        url: pathConfirmation, 
        data: confirmationResultat,
        headers: {'x-token-jwt': token}
    })

    // console.debug("!!! Fichier verification (POST) reponse : %O", reponse)

    if(reponse.data.ok === false) {
        const data = reponse.data
        console.error("Erreur verification fichier : %O", data)
        const err = new Error("Erreur upload fichier : %s", data.err)
        err.reponse = data
        throw err
    }

    return {
        status: reponse.status, 
        reponse: reponse.data
    }
}
