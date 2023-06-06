import { createSlice, isAnyOf, createListenerMiddleware } from '@reduxjs/toolkit'

const ETAT_PREPARATION = 1,
      ETAT_PRET = 2,
      ETAT_UPLOADING = 3,
      ETAT_COMPLETE = 4,
      ETAT_ECHEC = 5,
      ETAT_CONFIRME = 6,
      ETAT_UPLOAD_INCOMPLET = 7

const initialState = {
    liste: [],                  // Liste de fichiers en traitement (tous etats confondus)
    token: '',                  // Token de la batch courante
    batchId: '',                // Batch id courant
    progres: null,              // Pourcentage de progres en int
    completesCycle: [],         // Conserve la liste des uploads completes qui restent dans le total de progres
    listeBatch: [],             // Liste des fichiers dans la batch courante
    uploadActif: false,
}

function setTokenAction(state, action) {
    const { token, batchId } = action.payload
    state.token = token
    state.batchId = batchId
}

function clearTokenAction(state, action) {
    state.token = null
    state.batchId = null
}

function setUploadsAction(state, action) {
    // Merge listes
    const listeUploads = action.payload
    const listeExistanteMappee = state.liste.reduce((acc, item)=>{
        acc[item.correlation] = item
        return acc
    }, {})

    // Retirer les uploads connus
    const nouvelleListe = listeUploads.filter(item=>!listeExistanteMappee[item.correlation])
    
    // Push les items manquants a la fin de la liste
    nouvelleListe.forEach(item=>state.liste.push(item))
    
    const { pourcentage } = calculerPourcentage(state.liste, [])

    state.liste.sort(sortDateCreation)
    state.completesCycle = []
    state.progres = pourcentage
}

function clearCycleUploadAction(state, action) {
    state.completesCycle = []
}

function ajouterUploadAction(state, action) {
    const docUpload = action.payload
    const correlation = docUpload.correlation
    const infoUpload = state.liste.filter(item=>item.correlation === correlation).pop()
    // console.debug("ajouterUploadAction correlation %s info existante %O", correlation, infoUpload)
    if(!infoUpload) {
        // Ajouter l'upload, un middleware va charger le reste de l'information
        // console.debug("Ajout upload %O", correlation)
        state.liste.push(docUpload)
        const { pourcentage } = calculerPourcentage(state.liste, state.completesCycle)
        state.progres = pourcentage
    } else {
        throw new Error(`Upload ${correlation} existe deja`)
    }
}

function updateUploadAction(state, action) {
    const docUpload = action.payload
    const correlation = docUpload.correlation

    // Trouver objet existant
    const infoUpload = state.liste.filter(item=>item.correlation === correlation).pop()
    // Detecter changement etat a confirme
    if(infoUpload.etat === ETAT_COMPLETE && docUpload.etat === ETAT_CONFIRME) {
        state.completesCycle.push(correlation)
    }

    if(!infoUpload) state.liste.push(infoUpload)    // Append
    else Object.assign(infoUpload, docUpload)       // Merge

    const { pourcentage } = calculerPourcentage(state.liste, state.completesCycle)
    state.progres = pourcentage
}

function continuerUploadAction(state, action) {
    const docUpload = action.payload
    
    // docUpload peut etre null si on fait juste redemarrer le middleware
    if(docUpload) {
        const correlation = docUpload.correlation

        // Trouver objet existant
        const infoUpload = state.liste.filter(item=>item.correlation === correlation).pop()

        if(!infoUpload) state.liste.push(infoUpload)    // Append
        else Object.assign(infoUpload, docUpload)       // Merge
    }

    const { pourcentage } = calculerPourcentage(state.liste, state.completesCycle)
    state.progres = pourcentage
}

function retirerUploadAction(state, action) {
    const correlation = action.payload
    state.liste = state.liste.filter(item=>item.correlation !== correlation)

    const { pourcentage } = calculerPourcentage(state.liste, state.completesCycle)
    state.progres = pourcentage
}

function clearUploadsAction(state, action) {
    state.listeBatch = []
    state.liste = []
    state.progres = null
    state.completesCycle = []
}

function supprimerUploadsParEtatAction(state, action) {
    const etat = action.payload
    state.liste = state.liste.filter(item=>{
        // Nettoyer liste completes
        const correlation = item.correlation
        state.completesCycle.filter(item=>item.correlation !== correlation)

        // Filtrer etat a retirer
        return item.etat !== etat
    })

    const { pourcentage } = calculerPourcentage(state.liste, state.completesCycle)
    state.progres = pourcentage
}

function arretUploadAction(state, action) {
    // Middleware trigger seulement
}

function setUploadActifAction(state, action) {
    state.uploadActif = action.payload
    if(action.payload === false) {
        // Clear progres
        state.progres = null
    }
}

function pushBatchCompleteeAction(state, action) {
    const correlation = action.payload
    const upload = state.liste.filter(item=>item.correlation = correlation).pop()
    if(upload) {
        // Concatener nouvel upload reussi
        state.listeBatch = [...state.listeBatch, upload]
    }
}

function setBatchUploadAction(state, action) {
    state.listeBatch = action.payload
}

const uploadSlice = createSlice({
    name: 'uploader',
    initialState,
    reducers: {
        setToken: setTokenAction,
        clearToken: clearTokenAction,
        ajouterUpload: ajouterUploadAction,
        updateUpload: updateUploadAction,
        retirerUpload: retirerUploadAction,
        setUploads: setUploadsAction,
        clearUploadsState: clearUploadsAction,
        supprimerUploadsParEtat: supprimerUploadsParEtatAction,
        majContinuerUpload: continuerUploadAction,
        arretUpload: arretUploadAction,
        clearCycleUpload: clearCycleUploadAction,
        setUploadActif: setUploadActifAction,
        pushBatchCompletee: pushBatchCompleteeAction,
        setBatchUpload: setBatchUploadAction
    }
})

export const { 
    setToken, clearToken, ajouterUpload, updateUpload, retirerUpload, setUploads, 
    clearUploadsState, supprimerUploadsParEtat, majContinuerUpload,
    arretUpload, clearCycleUpload, setUploadActif, pushBatchCompletee, setBatchUpload,
} = uploadSlice.actions
export default uploadSlice.reducer

// Thunks

export function demarrerUploads(workers, correlationIds) {
    return (dispatch, getState) => traiterDemarrerUploads(workers, correlationIds, dispatch, getState)
}

async function traiterDemarrerUploads(workers, correlationIds, dispatch, getState) {
    // console.debug("traiterDemarrerUploads ", correlationIds)
    if(typeof(correlationIds) === 'string') correlationIds = [correlationIds]
    correlationIds.forEach(correlation=>{
        dispatch(ajouterUpload(correlation))
    })
}

export function clearUploads(workers) {
    return (dispatch, getState) => traiterClearUploads(workers, dispatch, getState)
}

async function traiterClearUploads(workers, dispatch, getState) {
    // console.debug("traiterClearUploads")
    const { uploadFichiersDao } = workers
    await uploadFichiersDao.clear()
    dispatch(clearUploadsState())
}

export function supprimerParEtat(workers, etat) {
    return (dispatch, getState) => traiterSupprimerParEtat(workers, etat, dispatch, getState)
}

async function traiterSupprimerParEtat(workers, etat, dispatch, getState) {
    // console.debug("traiterSupprimerParEtat ", etat)
    const { uploadFichiersDao } = workers
    const state = getState().uploader
    const batchId = state.batchId
    await uploadFichiersDao.supprimerParEtat(batchId, etat)
    dispatch(supprimerUploadsParEtat(etat))
}

export function continuerUpload(workers, opts) {
    opts = opts || {}
    return (dispatch, getState) => traiterContinuerUpload(workers, dispatch, getState, opts)
}

async function traiterContinuerUpload(workers, dispatch, getState, opts) {
    opts = opts || {}
    const correlation = opts.correlation
    // console.debug("traiterContinuerUpload (correlation %s)", correlation)

    const { uploadFichiersDao } = workers
    const state = getState().uploader
    const batchId = state.batchId

    const uploads = await uploadFichiersDao.chargerUploads(batchId)
    const uploadsIncomplets = uploads.filter(item => {
        if(correlation) return item.correlation === correlation
        else return [ETAT_UPLOAD_INCOMPLET, ETAT_ECHEC].includes(item.etat)
    })

    if(uploadsIncomplets.length > 0) {
        for await (const upload of uploadsIncomplets) {
            upload.etat = ETAT_PRET
            await uploadFichiersDao.updateFichierUpload(upload)
            dispatch(majContinuerUpload(upload))
        }
    } else{
        // Kick-off middleware pour uploads prets
        dispatch(majContinuerUpload())
    }
}

export function annulerUpload(workers, correlation) {
    return (dispatch, getState) => traiterAnnulerUpload(workers, correlation, dispatch, getState)
}

async function traiterAnnulerUpload(workers, correlation, dispatch, getState) {
    // console.debug("traiterAnnulerUpload ", correlation)
    const { uploadFichiersDao } = workers
    const state = getState().uploader
    const upload = state.liste.filter(item=>item.correlation===correlation).pop()
    if(upload) {
        if(upload.etat === ETAT_UPLOADING) {
            // Arreter l'upload courant
            dispatch(arretUpload())
        }
        // Supprimer le fichier
        await uploadFichiersDao.supprimerFichier(correlation)
        dispatch(retirerUpload(correlation))
    }
}

export function confirmerUpload(workers, correlation) {
    return (dispatch, getState) => traiterConfirmerUpload(workers, correlation, dispatch, getState)
}

async function traiterConfirmerUpload(workers, correlation, dispatch, getState) {
    // console.debug("traiterConfirmerUpload ", correlation)
    const { uploadFichiersDao } = workers
    const state = getState().uploader
    const upload = state.liste.filter(item=>item.correlation===correlation).pop()
    if(upload) {
        const uploadCopie = {...upload}
        uploadCopie.etat = ETAT_CONFIRME
        uploadCopie.dateConfirmation = new Date().getTime()

        // Supprimer parts
        await uploadFichiersDao.supprimerPartsFichier(state.batchId, correlation)

        // Maj contenu upload
        await uploadFichiersDao.updateFichierUpload(uploadCopie)

        // Maj redux state
        await dispatch(updateUpload(uploadCopie))
        await dispatch(pushBatchCompletee(correlation))
    }
}

// Uploader middleware
export function uploaderMiddlewareSetup(workers) {
    const uploaderMiddleware = createListenerMiddleware()
    
    uploaderMiddleware.startListening({
        matcher: isAnyOf(ajouterUpload, setUploads, majContinuerUpload),
        effect: (action, listenerApi) => uploaderMiddlewareListener(workers, action, listenerApi)
    }) 
    
    return uploaderMiddleware
}

async function uploaderMiddlewareListener(workers, action, listenerApi) {
    // console.debug("uploaderMiddlewareListener running effect, action : %O, listener : %O", action, listenerApi)
    // console.debug("Arret upload info : %O", arretUpload)

    await listenerApi.unsubscribe()
    try {
        // Reset liste de fichiers completes utilises pour calculer pourcentage upload
        listenerApi.dispatch(clearCycleUpload())

        const task = listenerApi.fork( forkApi => tacheUpload(workers, listenerApi, forkApi) )
        const stopAction = listenerApi.condition(arretUpload.match)
        await Promise.race([task.result, stopAction])

        // console.debug("Task %O\nstopAction %O", task, stopAction)
        task.result.catch(err=>console.error("Erreur task : %O", err))
        stopAction
            .then(()=>task.cancel())
            .catch(()=>{
                // Aucun impact
            })

        await task.result  // Attendre fin de la tache en cas d'annulation
        // console.debug("uploaderMiddlewareListener Sequence upload terminee")
    } finally {
        await listenerApi.subscribe()
    }
}

async function tacheUpload(workers, listenerApi, forkApi) {
    // console.debug("Fork api : %O", forkApi)
    const dispatch = listenerApi.dispatch

    let nextUpload = getProchainUpload(listenerApi.getState().uploader.liste)

    const cancelToken = {cancelled: false}
    const aborted = event => {
        // console.debug("Aborted ", event)
        cancelToken.cancelled = true
    }
    forkApi.signal.onabort = aborted

    if(!nextUpload) return  // Rien a faire

    dispatch(setUploadActif(true))

    // Commencer boucle d'upload
    try {
        while(nextUpload) {
            console.debug("Next upload : %O", nextUpload)
            const { batchId, correlation } = nextUpload
            try {
                await uploadFichier(workers, dispatch, nextUpload, cancelToken)

                // Trouver prochain upload
                if (forkApi.signal.aborted) {
                    // console.debug("tacheUpload annulee")
                    marquerUploadEtat(workers, dispatch, batchId, correlation, {etat: ETAT_UPLOAD_INCOMPLET})
                        .catch(err=>console.error("Erreur marquer upload echec %s : %O", correlation, err))
                    return
                }
                nextUpload = getProchainUpload(listenerApi.getState().uploader.liste)

            } catch (err) {
                console.error("Erreur tache upload correlation %s: %O", correlation, err)
                marquerUploadEtat(workers, dispatch, batchId, correlation, {etat: ETAT_ECHEC})
                    .catch(err=>console.error("Erreur marquer upload echec %s : %O", correlation, err))
                throw err
            }
        }
    } finally {
        dispatch(setUploadActif(false))
    }
}

async function uploadFichier(workers, dispatch, fichier, cancelToken) {
    console.debug("Upload fichier workers : ", workers)
    const { uploadFichiersDao, transfertFichiers, chiffrage } = workers
    const { batchId, correlation, token } = fichier

    // Charger la liste des parts a uploader
    let parts = await uploadFichiersDao.getPartsFichier(batchId, correlation)
    
    // Retirer les partis qui sont deja uploadees
    let tailleCompletee = 0,
        positionsCompletees = fichier.positionsCompletees,
        retryCount = fichier.retryCount
    parts = parts.filter(item=>{
        const dejaTraite = positionsCompletees.includes(item.position)
        if(dejaTraite) tailleCompletee += item.taille
        return !dejaTraite
    })
    // console.debug("Parts a uploader : ", parts)

    await marquerUploadEtat(workers, dispatch, batchId, correlation, {etat: ETAT_UPLOADING})

    // Mettre a jour le retryCount
    retryCount++
    await marquerUploadEtat(workers, dispatch, batchId, correlation, {retryCount})

    for await (const part of parts) {
        let tailleCumulative = tailleCompletee
        const position = part.position,
              partContent = part.data
        await marquerUploadEtat(workers, dispatch, batchId, correlation, {tailleCompletee: tailleCumulative})
        
        // await new Promise(resolve=>setTimeout(resolve, 250))
        const opts = {}
        const resultatUpload = transfertFichiers.partUploader(token, correlation, position, partContent, opts)
        // await Promise.race([resultatUpload, cancelToken])
        await resultatUpload
        // console.debug("uploadFichier Resultat upload %s (cancelled? %O) : %O", correlation, cancelToken, resultatUpload)

        if(cancelToken && cancelToken.cancelled) {
            console.warn("Upload cancelled")
            return
        }

        tailleCompletee += part.taille
        positionsCompletees = [...positionsCompletees, position]
        await marquerUploadEtat(workers, dispatch, batchId, correlation, {tailleCompletee, positionsCompletees})
    }

    // Signer et uploader les transactions
    // const transactionMaitredescles = {...fichier.transactionMaitredescles}
    // const partitionMaitreDesCles = transactionMaitredescles['_partition']
    // delete transactionMaitredescles['_partition']
    // const cles = await chiffrage.formatterMessage(
    //     transactionMaitredescles, 'MaitreDesCles', {partition: partitionMaitreDesCles, action: 'sauvegarderCle', DEBUG: false})

    // const transaction = await chiffrage.formatterMessage(
    //     fichier.transactionGrosfichiers, 'GrosFichiers', {action: 'nouvelleVersion'})

    // console.debug("Transactions signees : %O, %O", cles, transaction)
    // await transfertFichiers.confirmerUpload(token, batchId, correlation, fichier.transactionMaitredescles, fichier.transactionGrosfichiers)
    console.debug("uploadFichier Info fichiers uploade ", fichier)
    const infoGrosFichiers = fichier.transactionGrosfichiers,
          hachage = infoGrosFichiers.fuuid
    // await transfertFichiers.confirmerUpload(token, correlation, {hachage, transaction: infoGrosFichiers, cle: fichier.cle})
    await transfertFichiers.confirmerUpload(token, correlation, {hachage})

    // Upload complete, dispatch nouvel etat
    await marquerUploadEtat(workers, dispatch, batchId, correlation, {etat: ETAT_COMPLETE})
    await dispatch(confirmerUpload(workers, correlation))
        .catch(err=>console.error("Erreur cleanup fichier upload ", err))
}

async function marquerUploadEtat(workers, dispatch, batchId, correlation, etat) {
    const contenu = {batchId, correlation, ...etat}
    const { uploadFichiersDao } = workers
    
    await uploadFichiersDao.updateFichierUpload(contenu)
    
    return dispatch(updateUpload(contenu))
}

function sortDateCreation(a, b) {
    if(a === b) return 0
    if(!a) return 1
    if(!b) return -1

    const dcA = a.dateCreation,
          dcB = b.dateCreation
    
    if(dcA === dcB) return 0
    if(!dcA) return 1
    if(!dcB) return -1

    return dcA - dcB
}

function calculerPourcentage(liste, completesCycle) {
    let tailleTotale = 0, 
        tailleCompleteeTotale = 0

    const inclureEtats = [ETAT_PRET, ETAT_ECHEC, ETAT_UPLOADING, ETAT_UPLOAD_INCOMPLET]
    liste.forEach( upload => {
        const { correlation, etat, tailleCompletee, taille } = upload

        let inclure = false
        if(inclureEtats.includes(etat)) inclure = true
        else if([ETAT_COMPLETE, ETAT_CONFIRME].includes(etat) && completesCycle.includes(correlation)) inclure = true

        if(inclure) {
            tailleCompleteeTotale += tailleCompletee
            tailleTotale += taille
        }
    })

    const pourcentage = Math.floor(100 * tailleCompleteeTotale / tailleTotale)

    return {total: tailleTotale, complete: tailleCompleteeTotale, pourcentage}
}

function getProchainUpload(liste) {
    // console.debug("Get prochain upload pre-tri ", liste)
    const listeCopie = liste.filter(item=>item.etat === ETAT_PRET)
    listeCopie.sort(trierListeUpload)
    // console.debug("Get prochain upload : ", listeCopie)
    return listeCopie.shift()
}

export function trierListeUpload(a, b) {
    if(a === b) return 0
    if(!a) return 1
    if(!b) return -1

    // // Trier par taille completee (desc)
    // const tailleCompleteeA = a.tailleCompletee,
    //       tailleCompleteeB = b.tailleCompletee
    // if(tailleCompleteeA !== tailleCompleteeB) {
    //     if(!tailleCompleteeA) return 1
    //     if(!tailleCompleteeB) return -1
    //     return tailleCompleteeB - tailleCompleteeA
    // }

    // Trier par date de creation
    const dateCreationA = a.dateCreation,
          dateCreationB = b.dateCreation
    // if(dateCreationA === dateCreationB) return 0
    if(dateCreationA !== dateCreationB) return dateCreationA - dateCreationB
    if(!dateCreationA) return 1
    if(!dateCreationB) return -1

    const cA = a.correlation,
          cB = b.correlation
    return cA.localeCompare(cB)
}