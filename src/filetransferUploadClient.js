import path from 'path'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
// import { forgecommon, creerCipher, preparerCommandeMaitrecles } from '@dugrema/millegrilles.utiljs/src/index'
// import { preparerCipher, preparerCommandeMaitrecles } from '@dugrema/millegrilles.utiljs/src/chiffrage'
import { splitPEMCerts } from '@dugrema/millegrilles.utiljs/src/forgecommon.js'
import { pki } from '@dugrema/node-forge'
import { base64 } from 'multiformats/bases/base64'

import { getAcceptedFileReader, streamAsyncIterable } from './stream.js'
import { preparerCipher, preparerCommandeMaitrecles }  from './chiffrage'
import * as hachage from './hachage'

// const { splitPEMCerts } = forgecommon

// Globals
// Structure uploads : {file: AcceptedFile, status=1, }
var _uploadsPending = [],
    _uploadEnCours = null,
    _uploadsCompletes = []

// Workers
var _chiffrage = null

// Callback etat : (nbFichiersPending, pctFichierEnCours, {encours: uuid, complete: uuid})
var _callbackEtatUpload = null,
    _publicKeyCa = null,
    _fingerprintCa = null,
    _certificat = null,
    _domaine = 'GrosFichiers',
    _pathServeur = '/collections/fichiers'

const BATCH_SIZE = 1 * 1024 * 1024  // 1 MB
const STATUS_NOUVEAU = 1,
      STATUS_ENCOURS = 2,
      STATUS_SUCCES = 3,
      STATUS_ERREUR = 4,
      STATUS_NONCONFIRME = 5

export function up_setPathServeur(pathServeur) {
    _pathServeur = pathServeur
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

export async function up_ajouterFichiersUpload(acceptedFiles, opts) {
    if(!_chiffrage) throw new Error("_chiffrage non initialise")

    opts = opts || {}
    const cuuid = opts.cuuid    // Collection de destination

    // for(let i=0; i<acceptedFiles.length; i++) {
    const infoUploads = acceptedFiles.map(file=>{
        //const file = acceptedFiles[i]
        //console.debug("Ajouter upload : %O", file)

        let dateFichier = null
        try {
          dateFichier = Math.floor(file.lastModified / 1000)
        } catch(err) {
          console.warn("Erreur chargement date fichier : %O", err)
        }

        // const nomFichierBuffer = new Uint8Array(Buffer.from(new TextEncoder().encode(file.name)))
        // throw new Error("Nom fichier buffer : " + nomFichierBuffer)

        const transaction = {
          nom: file.name.normalize(),  // iOS utilise la forme decomposee (combining)
          mimetype: file.type || 'application/octet-stream',
          taille: file.size,
          dateFichier,
        }
        if(cuuid) transaction['cuuid'] = cuuid
        
        const infoUpload = {
            file: file.object,
            size: file.size,
            correlation: uuidv4(),
            transaction,
        }

        // Ajouter a la liste d'uploads a traiter
        _uploadsPending.push({
            ...infoUpload,
            status: STATUS_NOUVEAU,
            position: 0,              // Position du byte de debut de la batch actuelle
            batchLoaded: 0,           // Bytes charges par la batch actuelle
            pctFichierEnCours: 0,     // Pct de progres total du fichier en cours
            cancelTokenSource: null,  // Cancel token pour axios
            complete: false,
        })

        return infoUpload
    })

    // console.info("Uploads pending : %O", _uploadsPending)
    emettreEtat()
    traiterUploads()  // Demarrer traitement si pas deja en cours

    return infoUploads
}

async function traiterUploads() {
    if(_uploadEnCours) return  // Rien a faire
    if(!_chiffrage) throw new Error("_chiffrage non initialise")

    let complete = ''
    _uploadEnCours = _uploadsPending.shift()
    if(_uploadEnCours) {
        _uploadEnCours.status = STATUS_ENCOURS

        try {
            emettreEtat({complete}).catch(err=>(console.warn("Erreur maj etat : %O", err)))
            await uploadFichier()
        } catch(err) {
            console.error("Erreur PUT fichier : %O", err)
            _uploadEnCours.status = STATUS_ERREUR
            _uploadEnCours.err = {msg: ''+err, stack: err.stack}
        } finally {
            try {
                if(!_uploadEnCours.annuler) {
                    _uploadsCompletes.push(_uploadEnCours)
                }
                complete = _uploadEnCours.correlation
                _uploadEnCours.complete = true

                const { transaction, status } = _uploadEnCours
                _uploadEnCours = null
                emettreEtat({complete, transaction, status}).catch(err=>(console.warn("Erreur maj etat : %O", err)))
            } catch(err) {
                console.warn("Erreur finalisation upload fichier : %O", err)
            } finally {
                // Poursuivre
                traiterUploads()
            }
        }
    }
    
}

/** Effectue l'upload d'un fichier. */
async function uploadFichier() {
    if(!_chiffrage) throw new Error("_chiffrage non initialise")

    const correlation = _uploadEnCours.correlation

    // console.debug("Traiter upload en cours : %O", _uploadEnCours)
    const transformHandler = await preparerTransform()
    const cipher = transformHandler.cipher
    const transform = data => cipher.update(data)
    
    const reader = streamAsyncIterable(getAcceptedFileReader(_uploadEnCours.file), {batchSize: BATCH_SIZE, transform})

    try {
        var position = 0
        for await (let batchContent of reader) {
            const pathUpload = path.join(_pathServeur, ''+correlation, ''+position)
            position += batchContent.length
            const cancelTokenSource = axios.CancelToken.source()

            _uploadEnCours.cancelTokenSource = cancelTokenSource
            _uploadEnCours.batchTotal = batchContent.length
        
            const reponse = await axios({
                url: pathUpload,
                method: 'PUT',
                headers: { 'content-type': 'application/data' },
                data: batchContent,
                onUploadProgress,
                cancelToken: cancelTokenSource.token,
            })

            _uploadEnCours.position = position
            _uploadEnCours.batchLoaded = 0  // Position ajustee, on reset loaded immediatement (evite promenage % progres)
            _uploadEnCours.pctFichierEnCours = Math.floor(position/_uploadEnCours.size * 100)
            // console.debug("Reponse upload %s position %d Pct: %d put block %O", correlation, position, _uploadEnCours.pctFichierEnCours, reponse)
            emettreEtat().catch(err=>(console.warn("Erreur maj etat : %O", err)))
        }

        // Preprarer commande maitre des cles
        // const resultatChiffrage = await transformHandler.finish()
        const resultatChiffrage = await cipher.finalize()
        const {hachage: hachage_bytes, tag} = resultatChiffrage
        const iv = base64.encode(transformHandler.iv)
        // console.debug("Resultat chiffrage : %O", resultatChiffrage)
        const identificateurs_document = { fuuid: hachage_bytes }
        const commandeMaitreDesCles = await preparerCommandeMaitrecles(
            [_certificat[0]], transformHandler.secretKey, _domaine, hachage_bytes, iv, tag, identificateurs_document, {DEBUG: false})

        // Ajouter cle du cert de millegrille
        commandeMaitreDesCles.cles[_fingerprintCa] = transformHandler.secretChiffre
        // console.debug("Commande maitre des cles : %O", commandeMaitreDesCles)
        _uploadEnCours.commandeMaitreDesCles = commandeMaitreDesCles

        _uploadEnCours.transaction.fuuid = hachage_bytes

        // Emettre la commande POST pour conserver le fichier
        const reponsePost = await terminerTraitementFichier(_uploadEnCours)
        if(reponsePost.status === 201) {
            // console.debug("Fichier %s complete", correlation)
            _uploadEnCours.status = STATUS_SUCCES
        } else if(reponsePost.status === 202 ) {
            // console.debug("Fichier %s valide mais sans confirmation (pending)", correlation)
            _uploadEnCours.status = STATUS_NONCONFIRME
        }
    } catch(err) {
        if(_uploadEnCours) {
            const correlation = _uploadEnCours.correlation
            console.error("Erreur traitement fichier, DELETE %s : %O", correlation, err)
            const pathConfirmation = path.join(_pathServeur, correlation)
            try{
                await axios({
                    method: 'DELETE', 
                    url: pathConfirmation, 
                })
            } catch(err) {
                console.info("Erreur DELETE fichier : %s", correlation)
            }
        } else {
            console.warn("Erreur traitement upload fichier mais aucun fichier en cours : %O", err)
        }
        throw err
    }
}

async function terminerTraitementFichier(uploadEnCours) {
    if(!_chiffrage) throw new Error("_chiffrage non initialise")

    // console.debug("terminerTraitementFichier %O", uploadEnCours)
    const { commandeMaitreDesCles, transaction } = uploadEnCours
    const partitionMaitreDesCles = commandeMaitreDesCles._partition
    if(!partitionMaitreDesCles) throw new Error("Partition maitre des cles n'est pas identifiee")
    delete commandeMaitreDesCles._partition

    const maitreDesClesSignees = await _chiffrage.formatterMessage(
        commandeMaitreDesCles, 'MaitreDesCles', {partition: partitionMaitreDesCles, action: 'sauvegarderCle', DEBUG: false})
    uploadEnCours.commandeMaitreDesCles = maitreDesClesSignees
    
    const transactionSignee = await _chiffrage.formatterMessage(
        transaction, 'GrosFichiers', {action: 'nouvelleVersion'})
    uploadEnCours.transaction = transactionSignee

    // console.debug("Etat fichier uploadEnCours : %O", uploadEnCours)

    const confirmationResultat = {
        cles: maitreDesClesSignees, 
        transaction: transactionSignee,
    }

    const pathConfirmation = path.join(_pathServeur, uploadEnCours.correlation)
    const reponse = await axios({
        method: 'POST', 
        url: pathConfirmation, 
        data: confirmationResultat,
    })

    // console.info("!!! Fichier verification (POST) reponse : %O", reponse)

    if(reponse.data.ok === false) {
        const data = reponse.data
        console.error("Erreur verification fichier : %O", data)
        const err = new Error("Erreur upload fichier : %s", data.err)
        err.reponse = data
        throw err
    }

    return {
        status: reponse.status, 
        reponse: reponse.data, 
        cles: maitreDesClesSignees, 
        transaction: transactionSignee
    }
}

/** Retourne un StreamReader qui applique les transformations requises */
async function preparerTransform() {
    return preparerCipher({clePubliqueEd25519: _publicKeyCa})
}

function onUploadProgress(progress) {
    const {loaded, total} = progress
    // console.debug("Axios progress sur %s : %d/%d", _uploadEnCours.correlation, loaded, total)
    if( !isNaN(loaded) && !isNaN(total) ) {
        _uploadEnCours.batchLoaded = loaded
        _uploadEnCours.batchTotal = total

        const pctProgres = Math.floor(loaded / total * 100)
        _uploadEnCours.pctBatchProgres = pctProgres
    }
    emettreEtat().catch(err=>(console.warn("Erreur maj etat : %O", err)))
}

export async function up_annulerUpload(correlation) {
    if(_uploadEnCours && (!correlation || _uploadEnCours.correlation === correlation)) {
        // console.debug("Annuler l'upload en cours (%s)", correlation)
        _uploadEnCours.annuler = true
        if(_uploadEnCours.cancelTokenSource) {
            // Toggle annulation dans Axios
            _uploadEnCours.cancelTokenSource.cancel('Usager annule upload')
        }
    } else {
        // console.debug("Retirer upload %s de la liste des pendings", correlation)
        const pending = _uploadsPending.filter(item=>item.correlation!==correlation)
        _uploadsPending = pending
    }
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

export function up_setCertificat(certificat) {
    if( typeof(certificat) === 'string' ) {
        certificat = splitPEMCerts(certificat)
    }
    _certificat = certificat
}

export function up_setDomaine(domaine) {
    _domaine = domaine
}

export function up_setChiffrage(chiffrage) {
    // console.debug("ChiffrageWorker : %O", chiffrage)
    _chiffrage = chiffrage
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
