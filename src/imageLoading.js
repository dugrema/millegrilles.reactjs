
const CONST_TIMEOUT_THUMBNAIL_BLOB = 15000

// Charge un fichier chiffre.
// Utilise un cache/timer pour reutiliser le blob si l'image est chargee/dechargee rapidement.
export function loadFichierChiffre(getFichierChiffre, fuuid, opts) {
    opts = opts || {}
    // const { traitementFichiers } = workers
    const { delay } = opts
    const timeoutBlob = opts.timeout || CONST_TIMEOUT_THUMBNAIL_BLOB

    let blobPromise = null
    let timeoutCleanup = null
    let controller = null
    
    return {
        load: async setSrc => {
            opts = opts || {}

            if(!blobPromise) {
                // console.debug("Reload blob pour %s", fuuid)
                if(controller) controller.abort() // S'assurer d'annuler un download en limbo
                controller = new AbortController()
                blobPromise = reloadFichier(getFichierChiffre, fuuid, {...opts, controller})
            } else if(timeoutCleanup) {
                // console.debug("Reutilisation blob pour thumbnail %s", fuuid)
                clearTimeout(timeoutCleanup)
                timeoutCleanup = null
            }

            try {
                var urlBlob = await blobPromise
                // console.debug("!!! Blob charger pour thumbnail %s (opts: %O)", fuuid, opts)

                if(delay) await new Promise(resolve=>(setTimeout(resolve, delay)))

                if(setSrc) setSrc(urlBlob)
                return urlBlob
            } catch(err) {
                // console.debug("Erreur chargement blob %s : %O", fuuid, err)
                // Cleanup
                blobPromise = null
                if(urlBlob) URL.revokeObjectURL(urlBlob)
                throw err
            } finally {
                controller = null
            }
        },
        unload: async () => {
            console.debug("Unload fichier %s", fuuid)
            if(controller) {
                controller.abort()
                controller = null
                console.info("Download de %s aborted", fuuid)
            }
            if(blobPromise) {
                try {
                    const urlBlob = await blobPromise
                    // console.debug("Cleanup URL blob : %O", urlBlob)
                    if(urlBlob) {
                        timeoutCleanup = setTimeout(()=>{
                            // console.debug("Cleanup blob pour %s", fuuid)
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

async function reloadFichier(getFichierChiffre, fuuid, opts) {
    const blob = await getFichierChiffre(fuuid, opts)
    return URL.createObjectURL(blob)
}

// Genere un loader concurrentiel qui affiche le premier de mini/small et tente
// d'afficher small lorsqu'il est pret
export function fileResourceLoader(getFichierChiffre, fichierFuuid, opts) {
    opts = opts || {}
    const { thumbnail } = opts

    // Preparation du mini-thumbnail (pour fallback ou attente de download) et de l'image pleine grandeur
    let miniLoader = null
    if(thumbnail && thumbnail.hachage && thumbnail.data_chiffre) {
        const thumbnailFuuid = thumbnail.hachage
        const dataChiffre = thumbnail.data_chiffre
        miniLoader = loadFichierChiffre(getFichierChiffre, thumbnailFuuid, {dataChiffre})
    }
    const fileLoader = loadFichierChiffre(getFichierChiffre, fichierFuuid)

    const loader = {
        load: async (setSrc, setters) => {
            setters = setters || {}
            const { setFirst, setThumbnail } = setters

            let miniPromise = null
            if(miniLoader) {
                miniPromise = miniLoader.load().then(src=>{
                    if(setThumbnail) setThumbnail(src)
                    return src
                })
            }

            const filePromise = fileLoader.load()

            // Charger le premier blob qui est pret
            try {
                const blobPret = await Promise.any([filePromise, miniPromise])
                if(setFirst) setFirst(blobPret)

                // Attendre que le blob de l'image complete soit pret, puis afficher
                // Note : aucun effet si le premier blob pret etait l'image
                try {
                    const blobFichier = await filePromise
                    if(setSrc) setSrc(blobFichier)
                    return blobFichier
                } catch(err) {
                    if(err && err.response && err.response.status === 404) {
                        console.warn("Fichier %s inconnu (404)", fichierFuuid)
                    } else {
                        console.debug("Erreur chargement de l'image %s : %O", fichierFuuid, err)
                    }
                }

                return blobPret
    
            } catch(err) {
                // Aucune image n'a charge
                console.error("Erreur chargement image %O", err)

                // Tenter de trouver un blob valide
                const blobPret = await Promise.race([miniPromise, imagePromise])
                if(setSrc) setSrc(blobPret)
                return blobPret
            }
        },
        unload: async () => {
            miniLoader.unload().catch(err=>console.debug("Erreur unload mini thumbnail %s", thumbnailFuuid))
            fileLoader.unload().catch(err=>console.debug("Erreur unload image %s", fichierFuuid))
        }
    }

    return loader
}