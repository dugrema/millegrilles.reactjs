
const CONST_TIMEOUT_THUMBNAIL_BLOB = 15000

// Charge un thumbnail/image. 
// Utilise un cache/timer pour reutiliser le blob si l'image est chargee/dechargee rapidement.
export function loadImageChiffree(traitementFichiersWorker, fuuid, opts) {
    opts = opts || {}
    // const { traitementFichiers } = workers
    const { delay } = opts
    const timeoutBlob = opts.timeout || CONST_TIMEOUT_THUMBNAIL_BLOB

    let blobPromise = null
    let timeoutCleanup = null
    
    return {
        load: async setSrc => {
            opts = opts || {}

            if(!blobPromise) {
                console.debug("Reload blob pour %s", fuuid)
                blobPromise = reloadImage(traitementFichiersWorker.getThumbnail, fuuid, opts)
            } else if(timeoutCleanup) {
                console.debug("Reutilisation blob pour thumbnail %s", fuuid)
                clearTimeout(timeoutCleanup)
                timeoutCleanup = null
            }

            try {
                var urlBlob = await blobPromise
                // console.debug("!!! Blob charger pour thumbnail %s (opts: %O)", fuuid, opts)

                if(delay) await new Promise(resolve=>(setTimeout(resolve, 2000)))

                if(setSrc) setSrc(urlBlob)
                return urlBlob
            } catch(err) {
                console.debug("Erreur chargement blob %s : %O", fuuid, err)
                // Cleanup
                blobPromise = null
                if(urlBlob) URL.revokeObjectURL(urlBlob)
                throw err
            }
        },
        unload: async () => {
            console.debug("Unload thumbnail %s", fuuid)
            if(blobPromise) {
                try {
                    const urlBlob = await blobPromise
                    // console.debug("Cleanup URL blob : %O", urlBlob)
                    if(urlBlob) {
                        timeoutCleanup = setTimeout(()=>{
                            console.debug("Cleanup blob pour %s", fuuid)
                            URL.revokeObjectURL(urlBlob)
                            blobPromise = null  // Vider promise, permet un reload
                            timeoutCleanup = null
                        }, timeoutBlob)
                    }
                } catch(err) {
                    console.debug("Erreur nettoyage blob %s : %O", fuuid, err) 
                    blobPromise = null  // Vider promise, permet un reload
                }
            }
        }
    }
}

async function reloadImage(getThumbnail, fuuid, opts) {
    const blob = await getThumbnail(fuuid, opts)
    return URL.createObjectURL(blob)
}

// Genere un loader concurrentiel qui affiche le premier de mini/small et tente
// d'afficher small lorsqu'il est pret
export function imageResourceLoader(traitementFichiersWorker, thumbnail, imageFuuid) {
    const thumbnailFuuid = thumbnail.hachage

    // Preparation du mini-thumbnail (pour fallback ou attente de download) et de l'image pleine grandeur
    const miniLoader = loadImageChiffree(traitementFichiersWorker, thumbnailFuuid, {dataChiffre: thumbnail.data_chiffre})
    const imageLoader = loadImageChiffree(traitementFichiersWorker, imageFuuid)

    const loader = {
        load: async setSrc => {

            const miniPromise = miniLoader.load()
            const imagePromise = imageLoader.load()

            // Charger le premier blob qui est pret
            try {
                const blobPret = await Promise.any([imagePromise, miniPromise])
                setSrc(blobPret)

                // Attendre que le blob de l'image complete soit pret, puis afficher
                // Note : aucun effet si le premier blob pret etait l'image
                try {
                    const blobImage = await imagePromise
                    setSrc(blobImage)
                } catch(err) {
                    if(err && err.response && err.response.status === 404) {
                        console.warn("Image %s inconnue (404)", imageFuuid)
                    } else {
                        console.debug("Erreur chargement de l'image %s : %O", imageFuuid, err)
                    }
                }
    
            } catch(err) {
                // Aucune image n'a charge
                console.error("Erreur chargement image %O", err)

                // Tenter de trouver un blob valide
                const blobPret = await Promise.race([miniPromise, imagePromise])
                setSrc(blobPret)
            }
        },
        unload: () => {
            miniLoader.unload().catch(err=>console.debug("Erreur unload mini thumbnail %s", thumbnailFuuid))
            imageLoader.unload().catch(err=>console.debug("Erreur unload image %s", imageFuuid))
        }
    }

    return loader
}
