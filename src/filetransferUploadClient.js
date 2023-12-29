import path from 'path'
import axios from 'axios'
import * as Comlink from 'comlink'
import { v4 as uuidv4 } from 'uuid'
import { pki } from '@dugrema/node-forge'
import { base64 } from 'multiformats/bases/base64'
import { BlobReader, ZipReader } from '@zip.js/zip.js'

import { getAcceptedFileReader, streamAsyncIterable } from './stream.js'
import { chiffrage }  from './chiffrage'
import * as hachage from './hachage'

import { getExtMimetypeMap } from '@dugrema/millegrilles.utiljs/src/constantes.js'

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

// Hacheurs reutilisables
const _hachageDechiffre = new hachage.Hacheur({hashingCode: 'blake2b-512', DEBUG: false}),
      _hachageChiffre = new hachage.Hacheur({hashingCode: 'blake2b-512', DEBUG: false})

_pathServeur.pathname = '/collections/fichiers'

const CONST_1MB = 1024 * 1024
const THRESHOLD_512kb = 10 * CONST_1MB,
      THRESHOLD_1mb = 25 * CONST_1MB,
      THRESHOLD_2mb = 50 * CONST_1MB,
      THRESHOLD_5mb = 100 * CONST_1MB,
      THRESHOLD_10mb = 250 * CONST_1MB,
      THRESHOLD_20mb = 500 * CONST_1MB,
      THRESHOLD_50mb = 1000 * CONST_1MB

// Retourne la taille a utiliser pour les batch
function getUploadBatchSize(fileSize) {
    if(!fileSize) throw new Error("NaN")
    if(fileSize < THRESHOLD_512kb) return 512 * 1024
    if(fileSize < THRESHOLD_1mb) return 1024 * 1024
    if(fileSize < THRESHOLD_2mb) return 2 * CONST_1MB
    if(fileSize < THRESHOLD_5mb) return 5 * CONST_1MB
    if(fileSize < THRESHOLD_10mb) return 10 * CONST_1MB
    if(fileSize < THRESHOLD_20mb) return 20 * CONST_1MB
    if(fileSize < THRESHOLD_50mb) return 50 * CONST_1MB
    return 100 * CONST_1MB
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
    console.info("Path serveur : ", _pathServeur.href)
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

    // iOS utilise la forme decomposee (combining). Fix avec normalize()
    const nom = file.name.normalize()

    let mimetype = file.type
    if(!mimetype || mimetype === 'application/octet-stream') {
        // Tenter de detecter le mimetype avec l'extension
        const extension = path.extname(nom.toLocaleLowerCase()).slice(1)
        if(extension) {
            const mapExtensions = getExtMimetypeMap()
            mimetype = mapExtensions[extension]
        }
        // Set default au besoin
        if(!mimetype) mimetype = 'application/octet-stream'
    }

    const transaction = {
        nom,
        mimetype,
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
    await _hachageChiffre.reset()
    return preparerCipher({clePubliqueEd25519: _publicKeyCa, hacheur: _hachageChiffre})
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
    console.debug('up_setCertificats Set _certificats : ', certificats)
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
    const positionFichier = params.positionFichier || -1
    const tailleCumulative = params.tailleCumulative || 0
    const { ajouterPart, setProgres, signalAnnuler } = fcts
    const { size } = fileMappe
    const { correlation } = params

    // Preparer chiffrage
    await _hachageDechiffre.reset()
    const transformInst = await preparerTransform()
    const transform = {
        update: async chunk => {
            await _hachageDechiffre.update(chunk)
            return await transformInst.cipher.update(chunk)
        },
        finalize: async () => {
            return await transformInst.cipher.finalize()
        },
        etatFinal: transformInst.cipher.etatFinal,
    }

    // console.debug("traiterAcceptedFiles Transform : ", transformInst)

    const batchSize = getUploadBatchSize(size)
    const reader = getAcceptedFileReader(file)
    const iterReader = streamAsyncIterable(reader, {batchSize, transform})

    const frequenceUpdate = 500
    let dernierUpdate = 0,
        compteurPosition = 0,
        taillePreparee = tailleCumulative

    for await (const chunk of iterReader) {
        if(signalAnnuler) if (await signalAnnuler()) throw new Error("Cancelled")

        // Conserver dans idb
        // if(ajouterPart) await ajouterPart(correlation, compteurPosition, Comlink.transfer(chunk))
        if(ajouterPart) await ajouterPart(correlation, compteurPosition, chunk)
        compteurPosition += chunk.length

        taillePreparee += chunk.length
        const now = new Date().getTime()
        if(setProgres) {
            if(dernierUpdate + frequenceUpdate < now) {
                dernierUpdate = now
                setProgres(Math.floor(100*taillePreparee/tailleTotale), {idxFichier: positionFichier})
            }
        }
    }

    const etatFinalChiffrage = transform.etatFinal()
    etatFinalChiffrage.secretChiffre = transformInst.secretChiffre
    etatFinalChiffrage.hachage_original = await _hachageDechiffre.finalize()
    // console.debug("Etat final chiffrage : ", etatFinalChiffrage)
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
    // console.debug("formatterDocIdb Champs a chiffrer ", metadataDechiffre)
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
    // console.debug("traiterFichier params %O", params)
    const { signalAnnuler } = fcts
    if(signalAnnuler) {
        if(await signalAnnuler()) throw new Error("Cancelled")
    }

    const now = new Date().getTime()
    const { userId, cuuid, token, skipTransactions } = params
    const { updateFichier } = fcts

    let demarrer = true
    if(params.demarrer !== undefined) demarrer = params.demarrer

    // Preparer fichier
    const fileMappe = mapAcceptedFile(file)
    fileMappe.transaction.cuuid = cuuid
    // console.debug("traiterFichier File mappe : ", fileMappe)
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
    if(updateFichier) await updateFichier(Comlink.transfer(docIdb), {demarrer: false})

    try {
        const paramsConserver = {...params, correlation, tailleTotale}
        // const debutConserverFichier = new Date().getTime()
        const etatFinalChiffrage = await conserverFichier(file, fileMappe, paramsConserver, fcts)
        // console.debug("traiterFichier Temps conserver fichier %d ms", new Date().getTime()-debutConserverFichier)

        const docIdbMaj = await formatterDocIdb(docIdb, etatFinalChiffrage)

        // Dispatch pour demarrer upload
        if(updateFichier) await updateFichier(Comlink.transfer(docIdbMaj), {demarrer})

        return etatFinalChiffrage
    } catch(err) {
        if(updateFichier) await updateFichier(Comlink.transfer(docIdb), {err: ''+err})
        throw err
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
    const fcts = { ajouterPart, updateFichier, setProgres, signalAnnuler }

    // console.debug("traiterAcceptedFilesV2 Accepted files ", acceptedFiles)
    const infoTaille = params.infoTaille || {}
    let tailleTotale = infoTaille.total || 0
    if(tailleTotale === 0) {
        // Calculer taille a partir de la batch
        for (const file of acceptedFiles) {
            tailleTotale += file.size
        }
    }

    const resultatChiffrage = []

    // console.debug("traiterAcceptedFilesV2 InfoTaille ", infoTaille)
    let tailleCumulative = infoTaille.positionChiffre || 0,
        positionFichier = infoTaille.positionFichier || 0
    for await (const file of acceptedFiles) {
        // console.debug("traiterAcceptedFilesV2 Traiter file ", file)
        // const debutTraiter = new Date().getTime()
        const resultat = await traiterFichier(file, tailleTotale, {...params, tailleCumulative, positionFichier}, fcts)
        resultatChiffrage.push(resultat)
        // console.debug("traiterAcceptedFilesV2 Temps traiterFichier %d ms", new Date().getTime()-debutTraiter)
        tailleCumulative += file.size
        positionFichier++
        infoTaille.positionChiffre = tailleCumulative
        infoTaille.positionFichier = positionFichier
    }
    // console.debug("Fin infoTaille ", infoTaille)

    return {chiffrage: resultatChiffrage, info: infoTaille}
}

var _cancelUploadToken = null

export function cancelUpload() {
    if(_cancelUploadToken) return _cancelUploadToken.cancel()
}

export async function partUploader(token, correlation, position, partContent, opts) {
    opts = opts || {}
    const onUploadProgress = opts.onUploadProgress,
    hachagePart = opts.hachagePart

    const pathUploadUrl = new URL(_pathServeur.href + path.join('/'+correlation, ''+position))
    // console.debug("partUploader pathUpload ", pathUploadUrl.href)
    const cancelTokenSource = axios.CancelToken.source()
    _cancelUploadToken = cancelTokenSource

    // console.debug("Cancel token source : ", cancelTokenSource)

    const headers = {
        'content-type': 'application/data',
        'x-token-jwt': token,
    }
    if(hachagePart) {
        headers['x-content-hash'] = hachagePart  // 'm4OQCIPFQ/07VX/RQIGDoC1LRyicc1VBRaZEPr9DPm9qrdyDE'
    }

    // console.debug("partUploader Part uploader headers ", headers)

    const reponse = await axios({
        url: pathUploadUrl.href,
        method: 'PUT',
        headers,
        data: partContent,
        onUploadProgress,
        cancelToken: cancelTokenSource.token,
      })
        .then(resultat=>{
            // console.debug("Resultat upload : ", resultat)
            return {status: resultat.status, data: resultat.data}
      })
        .catch(err=>{
            // console.error("partUploader Erreur upload : %O", err)
            const response = err.response
            // console.debug("partUploader Erreur response : %O", response)
            if(response.status === 409) return {status: response.status, data: null}  // Ok, part deja uploade avec succes. Skip
            throw err
        })
        .finally( () => _cancelUploadToken = null )

    return reponse
}

export async function confirmerUpload(token, correlation, opts) {
    opts = opts || {}
    const { transaction } = opts
    if(transaction) {
        var attachements = transaction.attachements || {},
            cle = opts.cle || attachements.cle
    } else {
        var attachements = null, cle = null
    }
    // console.debug("confirmerUpload %s cle : %O, transaction : %O", correlation, cle, transaction)

    let hachage = opts.hachage
    if(!hachage) {
        if(transaction) {
            const contenu = JSON.parse(transaction.contenu)
            hachage = contenu.fuuid
        }
    }
    if(!hachage) throw new Error("Hachage fichier manquant")

    const confirmationResultat = { etat: {correlation, hachage} }
    if(transaction) confirmationResultat.transaction = transaction
    // if(cle) confirmationResultat.cle = cle
    const pathConfirmation = _pathServeur.href + path.join('/' + correlation)
    try {
        const reponse = await axios({
            method: 'POST',
            url: pathConfirmation,
            data: confirmationResultat,
            headers: {'x-token-jwt': token},
            timeout: 30_000,
        })
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
    } catch(err) {
        if(err.code) {
            return { errcode: err.code, err: ''+err }
        }
        const response = err.response
        if(response) {
            const { status, data } = response
            return {
                status,
                reponse: data
            }
        } else {
            throw err
        }
    }
}

export async function supprimerUpload(token, correlation) {
    const pathConfirmation = _pathServeur.href + path.join('/' + correlation)

    let response
    try {
        response = await axios({
            method: 'DELETE',
            url: pathConfirmation,
            data: confirmationResultat,
            headers: {'x-token-jwt': token}
        })
    } catch(err) {
        response = err.response
    }

    return { status: response.status, data: response.data }
}

export async function parseZipFile(workers, userId, fichier, cuuid, updateFichier, ajouterPart) {
    const zipFileReader = new BlobReader(fichier)
    const zipReader = new ZipReader(zipFileReader)

    const ETAT_PREPARATION = 1,
          ETAT_PRET = 2

    const mapExtensions = getExtMimetypeMap()
    console.debug("Map extensions : ", mapExtensions)

    const setProgres = null
    const signalAnnuler = null

    const certificatsMaitredescles = await workers.clesDao.getCertificatsMaitredescles()
    up_setCertificats(certificatsMaitredescles)

    const dictRepertoires = {[cuuid]: {tuuid: cuuid, nom: '.', liste: []}}

    // Charger tous les sous-repertoires existants a partir de la destination
    const reponseSousRepertoires = await workers.connexion.getSousRepertoires(cuuid)
    console.debug("Sous repertoires de %s : %O", cuuid, reponseSousRepertoires)
    const cuuidsRepertoires = reponseSousRepertoires.liste.map(item=>item.tuuid)
    const repertoiresInconnus = new Set(cuuidsRepertoires)
    let repertoiresDechiffres = await workers.collectionsDao.getParTuuids(cuuidsRepertoires)
    repertoiresDechiffres = repertoiresDechiffres.filter(item=>!!item)  // Retirer reps inconnus
    repertoiresDechiffres.forEach(item=>{
        if(item) repertoiresInconnus.delete(item.tuuid)
    })

    console.debug("Repertoires dechiffres : %O, inconnus : %O", repertoiresDechiffres, repertoiresInconnus)

    if(repertoiresInconnus.size > 0) {
        const repInconnusListe = []
        for(const rep of repertoiresInconnus) {
            repInconnusListe.push(rep)  // Creer array
        }
        const listeRepsDechiffres = await getDocuments(workers, repInconnusListe)
        console.debug("Reponse repertoires inconnus : ", listeRepsDechiffres)
        for await (const rep of listeRepsDechiffres) {
            repertoiresDechiffres.push(rep)
            rep.user_id = userId
            await workers.collectionsDao.updateDocument(rep, {dechiffre: true})
            dictRepertoires[rep.tuuid] = {tuuid: rep.tuuid, nom: rep.nom, liste: []}
        }
        // const reponse = await workers.connexion.getDocuments(repInconnusListe)
        // throw new Error('todo - dechiffrer repertoires')
    }

    for(const rep of repertoiresDechiffres) {
        dictRepertoires[rep.tuuid] = {tuuid: rep.tuuid, nom: rep.nom, liste: []}
    }
    for(const rep of repertoiresDechiffres) {
        const repNode = dictRepertoires[rep.tuuid]
        const parent = dictRepertoires[rep.path_cuuids[0]]
        parent.liste.push(repNode)
    }

    console.debug("Hierarchie repertoires : ", dictRepertoires[cuuid])

    mapperRepertoireRecursivement(dictRepertoires, '', dictRepertoires[cuuid])
    const mappingRepertoires = Object.values(dictRepertoires).reduce((acc, item)=>{
        acc[item.path] = item.tuuid
        return acc
    }, {})

    console.debug("Repertoires connus : ", mappingRepertoires)


    for await (const entry of zipReader.getEntriesGenerator()) {
        console.debug("Zip entry : ", entry)

        const filename = entry.filename.normalize()

        const dirName = path.dirname(filename)
        const nom = path.basename(filename)
        console.debug("Repertoire : %s, nom fichier : %s", dirName, nom)

        if(entry.directory) {
            const parentCuuid = dirName==='.'?cuuid:mappingRepertoires['./' + dirName]
            if(!parentCuuid) {
                console.warn("Erreur repertoire parent inconnu, liste connus : ", mappingRepertoires)
                throw new Error(`Repertoire parent ${dirName} inconnu`)
            }

            let dirNameMappe = dirName + '/' + nom
            if(!dirName.startsWith('.')) dirNameMappe = './' + dirNameMappe
            console.debug("Mapper repertoire ", dirNameMappe)
            let repertoire = mappingRepertoires[dirNameMappe]
            if(!repertoire) {
                console.debug("Creer le repertoire %s sous parent cuuid %s", nom, parentCuuid)

                const metadataDechiffre = {nom}
                const identificateurs_document = {type: 'collection'}
                const certificatsChiffrage = await workers.connexion.getCertificatsMaitredescles()
                const {doc: metadataChiffre, commandeMaitrecles} = await workers.chiffrage.chiffrerDocument(
                    metadataDechiffre, 'GrosFichiers', certificatsChiffrage, {identificateurs_document, userId, DEBUG: false})
                console.debug("creerCollection metadataChiffre %O, commande Maitre des cles : %O", metadataChiffre, commandeMaitrecles)

                const opts = { cuuid: parentCuuid }
                // throw new Error('TODO creer repertoire')
                const reponseCreation = await workers.connexion.creerCollection(metadataChiffre, commandeMaitrecles, opts)
                console.debug("Reponse creation repertoire ", reponseCreation)
                if(reponseCreation.ok !== true) {
                    throw new Error(`Erreur creation repertoire ${dirNameMappe} : ${reponseCreation.err}`)
                }
                const cuuidCree = reponseCreation.tuuid
                repertoire = {tuuid: cuuidCree, nom, liste: []}
                dictRepertoires[cuuidCree] = repertoire
                dictRepertoires[parentCuuid].liste.push(repertoire)
                mappingRepertoires[dirNameMappe] = cuuidCree
            }
        } else {

            const extension = path.extname(nom.toLocaleLowerCase()).slice(1)
            const mimetype = mapExtensions[extension] || 'application/octet-stream'
            console.debug("Trouver mimetype avec extension '%s' : %O", extension, mimetype)

            // Mapper fichier
            let dateFichier = null
            try {
                dateFichier = Math.floor(entry.lastModDate.getTime() / 1000)
            } catch(err) {
                console.warn("Erreur chargement date fichier : %O", err)
            }

            const transaction = {
                nom,  // iOS utilise la forme decomposee (combining)
                mimetype,
                taille: entry.uncompressedSize,
                dateFichier,
            }

            const fileMappe = {
                nom,
                // file: file.object,
                size: entry.uncompressedSize,
                correlation: uuidv4(),
                transaction,
            }

            let cuuidRepertoire = dirName==='.'?cuuid:mappingRepertoires['./' + dirName]
            if(cuuidRepertoire) {
                fileMappe.transaction.cuuid = cuuidRepertoire
            } else {
                throw new Error(`Le repertoire ${dirName} n'est pas mappe`)
            }
            console.debug("dirname %s mappe au cuuid %s", dirName, cuuidRepertoire)
            // console.debug("traiterFichier File mappe : ", fileMappe)
            const fileSize = fileMappe.size

            const correlation = '' + uuidv4()

            const dateCreation = Math.floor(new Date().getTime() / 1000)

            const docIdb = {
                // PK
                correlation, userId, //token,

                // Metadata recue
                nom: fileMappe.nom || correlation,
                taille: fileSize, //fileMappe.size,
                mimetype,

                // Etat initial
                etat: ETAT_PREPARATION,
                positionsCompletees: [],
                tailleCompletee: 0,
                dateCreation,
                retryCount: -1,  // Incremente sur chaque debut d'upload
                transactionGrosfichiers: fileMappe.transaction,
                transactionMaitredescles: null,
            }

            console.debug("Fichier mappe ", docIdb)

            await updateFichier(Comlink.transfer(docIdb), {demarrer: false})
            const zipFileStream = new TransformStream()
            entry.getData(zipFileStream.writable)

            const fileStream = { readable: zipFileStream.readable }
            console.debug("Filestream readable : ", fileStream)

            const paramsConserver = {correlation, tailleTotale: fileSize}

            try {
                const etatFinalChiffrage = await conserverFichier(
                    fileStream, fileMappe, paramsConserver, {ajouterPart, setProgres, signalAnnuler})

                // Dispatch pour demarrer upload
                const docIdbMaj = await formatterDocIdb(docIdb, etatFinalChiffrage)
                console.debug("parseZipFile Fichier pret a uploader : ", docIdbMaj)
                if(updateFichier) await updateFichier(Comlink.transfer(docIdbMaj), {demarrer: true})
            } catch(err) {
                console.error("parseZipFile Erreur conserverFichier ", err)
            }
        }
    }
}

function mapperRepertoireRecursivement(dictRepertoires, pathParent, nodeCourant) {
    console.debug("mapperRepertoireRecursivement pathParent : %s, nodeCourant : %O", pathParent, nodeCourant)
    const liste = nodeCourant.liste
    const pathCourant = pathParent?pathParent + '/' + nodeCourant.nom:nodeCourant.nom
    dictRepertoires[nodeCourant.tuuid].path = pathCourant
    for(const rep of liste) {
        mapperRepertoireRecursivement(dictRepertoires, pathCourant, rep)
    }
}

export async function getDocuments(workers, tuuids) {
    const { connexion, chiffrage, clesDao } = workers
    const chiffrageUtils = chiffrage.chiffrage
    // console.debug("getDocuments Charger documents ", tuuids)
    const reponseFichiers = await connexion.getDocuments(tuuids)
    // console.debug("getDocuments Resultat chargement fichiers : ", reponseFichiers)
    const fichiers = reponseFichiers.fichiers

    const ref_hachage_bytes = fichiers.map(item=>item.metadata.ref_hachage_bytes)
    // console.debug("getDocuments Charger cles documents : %O", ref_hachage_bytes)
    const cles = await clesDao.getCles(ref_hachage_bytes)

    const resultat = []
    for await (const fichier of fichiers) {
        // console.debug("getDocuments Recu fichier %O", fichier)

        // const version_courante = fichier.version_courante
        const metadataChiffre = fichier.metadata
        const ref_hachage_bytes = metadataChiffre.ref_hachage_bytes

        // Recuperer cle
        const cle = cles[ref_hachage_bytes]

        // Dechiffrer metadata
        const metaDechiffree = await chiffrageUtils.dechiffrerChampsChiffres(metadataChiffre, cle)
        // console.debug("metadata dechiffre : %O", metaDechiffree)

        const contenu = {...fichier, ...metaDechiffree}
        // console.debug("Contenu fichier dechiffre : %O", contenu)
        resultat.push(contenu)
    }

    return resultat
}
