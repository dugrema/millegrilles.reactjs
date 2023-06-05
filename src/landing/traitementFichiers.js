// import { ajouterUpload } from '../redux/uploaderSlice'
import { ajouterUpload } from '@dugrema/millegrilles.reactjs/src/landing/uploaderSlice'

import * as Comlink from 'comlink'

function setup(workers) {
    return {
        traiterAcceptedFiles(dispatch, params, opts) {
            opts = opts || {}
            return traiterAcceptedFiles(workers, dispatch, params, opts)
        },
        // resLoader,
        clean,
        // downloadCache,
    }
}

export default setup

async function clean(urlBlobPromise) {
    try {
        const urlBlob = await urlBlobPromise
        // console.debug("Cleanup blob %s", urlBlob)
        URL.revokeObjectURL(urlBlob)
    } catch(err) {
        console.debug("Erreur cleanup URL Blob : %O", err)
    }
}

async function traiterAcceptedFiles(workers, dispatch, params, opts) {
    opts = opts || {}
    // console.debug("Workers : ", workers)
    const { acceptedFiles, batchId } = params
    const { setProgres, signalAnnuler } = opts
    const { transfertFichiers } = workers
    console.debug("traiterAcceptedFiles Debut pour batchId %s, fichiers %O", batchId, acceptedFiles)

    const ajouterPartProxy = Comlink.proxy(
        (correlation, compteurPosition, chunk) => {
            ajouterPart(workers, batchId, correlation, compteurPosition, chunk)
        }
    )
    const updateFichierProxy = Comlink.proxy((doc, opts) => {
        const docWithIds = {...doc, batchId}
        return updateFichier(workers, dispatch, docWithIds, opts)
    })
    const setProgresProxy = setProgres?Comlink.proxy(setProgres):null
    const resultat = await transfertFichiers.traiterAcceptedFilesV2(
        params, 
        ajouterPartProxy, 
        updateFichierProxy,
        setProgresProxy,
        signalAnnuler
    )

    return resultat
}

async function ajouterPart(workers, batchId, correlation, compteurPosition, chunk) {
    const { uploadFichiersDao } = workers
    console.debug("ajouterPart %s position %d : %O", correlation, compteurPosition, chunk)
    await uploadFichiersDao.ajouterFichierUploadFile(batchId, correlation, compteurPosition, chunk)
}

async function updateFichier(workers, dispatch, doc, opts) {
    opts = opts || {}
    const correlation = doc.correlation
    const demarrer = opts.demarrer || false,
          err = opts.err

    const { uploadFichiersDao } = workers

    console.debug("Update fichier %s demarrer? %s [err? %O] : %O", correlation, demarrer, err, doc)

    if(err) {
        console.error("Erreur upload fichier %s : %O", correlation, err)
        // Supprimer le fichier dans IDB
        uploadFichiersDao.supprimerFichier(correlation)
            .catch(err=>console.error('updateFichier Erreur nettoyage %s suite a une erreur : %O', correlation, err))
        return
    }
    
    await uploadFichiersDao.updateFichierUpload(doc)

    // Declencher l'upload si applicable
    console.debug("Ajouter upload ", doc)
    if(demarrer) dispatch(ajouterUpload(doc))
}
