import {trouverLabelImage, trouverLabelVideo} from './labelsRessources'

const CONST_TIMEOUT_THUMBNAIL_BLOB = 15000

// Charge un fichier chiffre.
// Utilise un cache/timer pour reutiliser le blob si l'image est chargee/dechargee rapidement.
export function loadFichierChiffre(getFichierChiffre, fuuid, mimetype, opts) {
    // console.debug("!!! loadFichierChiffre fuuid %s, mimetype %s, opts : %O", fuuid, mimetype, opts)
    opts = opts || {}
    // const { traitementFichiers } = workers
    const { delay, callbackOnClean } = opts
    const timeoutBlob = opts.timeout || CONST_TIMEOUT_THUMBNAIL_BLOB

    let blobPromise = null
    let timeoutCleanup = null
    let controller = null
    
    return {
        load: async setSrc => {

            if(!blobPromise) {
                // console.debug("Reload blob pour %s", fuuid)
                if(controller) controller.abort() // S'assurer d'annuler un download en limbo
                controller = new AbortController()
                blobPromise = reloadFichier(getFichierChiffre, fuuid, mimetype, {...opts, controller})
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
            // console.debug("Unload fichier %s", fuuid)
            if(controller) {
                controller.abort()
                controller = null
                // console.info("Download de %s aborted", fuuid)
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
                            if(callbackOnClean) callbackOnClean()
                        }, timeoutBlob)
                    }
                } catch(err) {
                    // console.debug("Erreur nettoyage blob %s : %O", fuuid, err) 
                    blobPromise = null  // Vider promise, permet un reload
                    if(callbackOnClean) callbackOnClean()
                }
            }
        }
    }
}

async function reloadFichier(getFichierChiffre, fuuid, mimetype, opts) {
    opts = opts || {}
    const blob = await getFichierChiffre(fuuid, {...opts, mimetype})
    return URL.createObjectURL(blob)
}

// Genere un loader concurrentiel qui affiche le premier de mini/small et tente
// d'afficher small lorsqu'il est pret
export function fileResourceLoader(getFichierChiffre, fichierFuuid, mimetype, opts) {
    // console.debug("!!! fileResourceLoader : %s mimetype %s", fichierFuuid, mimetype)
    opts = opts || {}
    const { thumbnail, cles } = opts

    // Preparation du mini-thumbnail (pour fallback ou attente de download) et de l'image pleine grandeur
    let miniLoader = null
    if(thumbnail && thumbnail.hachage && thumbnail.data_chiffre) {
        const thumbnailFuuid = thumbnail.hachage
        const dataChiffre = thumbnail.data_chiffre
        miniLoader = loadFichierChiffre(getFichierChiffre, thumbnailFuuid, thumbnail.mimetype, {dataChiffre, cles})
    }
    const fileLoader = loadFichierChiffre(getFichierChiffre, fichierFuuid, mimetype, {cles})

    const loader = {
        load: async (setSrc, setters, opts) => {
            setters = setters || {}
            opts = opts || {}
            const { erreurCb } = opts
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
                        if(erreurCb) erreurCb("Fichier inconnu : 404")
                    } else {
                        if(err.message !== 'canceled') {
                            console.debug("Erreur chargement de l'image %s : %O", fichierFuuid, err)
                        }
                        if(erreurCb) {
                            erreurCb({err, message: "Erreur traitement de l'image"})
                        }
                    }
                }

                return blobPret
    
            } catch(err) {
                // Aucune image n'a charge
                console.error("Erreur chargement image %O", err)
                if(erreurCb) erreurCb({err, message: "Erreur chargement de l'image"})

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

export function imageResourceLoader(getFichierChiffre, images, opts) {
    opts = opts || {}
    // console.debug("!!! imageResourceLoader images: %O, opts: %O", images, opts)
    const supporteWebp = opts.supporteWebp===false?false:true
    const anime = opts.anime?true:false
    const { fuuid, mimetype, cles } = opts

    const thumbnail = images.thumbnail || images.thumb

    const labels = Object.keys(images)
    const labelHauteResolution = trouverLabelImage(labels, {supporteWebp})
    // console.debug("Labels : %O", labels)

    // Generer loaders pour tous les labels (sauf thumbnail)
    const loaders = labels
    .filter(label=>label!=='thumb'&&label!=='thumbnail')
    .reduce((acc, item)=>{
        const image = images[item]
        acc[item] = fileResourceLoader(getFichierChiffre, image.hachage, image.mimetype, {thumbnail, cles})
        return acc
    }, {})
    if(fuuid && mimetype) {
        // Loader pour original
        loaders.original = fileResourceLoader(getFichierChiffre, fuuid, mimetype, {thumbnail, cles})
    }

    // Ajouter loader de thumbnail
    if(thumbnail && thumbnail.hachage && thumbnail.data_chiffre) {
        const thumbnailFuuid = thumbnail.hachage
        const dataChiffre = thumbnail.data_chiffre
        loaders['thumb'] = loadFichierChiffre(getFichierChiffre, thumbnailFuuid, thumbnail.mimetype, {dataChiffre, cles})
    }

    const loader = {
        load: async (selecteur, setSrc, opts) => {
            // console.debug("Loader selecteur %s  (disponibles: %O)", selecteur, Object.keys(loaders))
            if(selecteur === 'thumbnail') selecteur = 'thumb'
            else if(!selecteur || !Object.keys(loaders).includes(selecteur)) selecteur = labelHauteResolution  // Prendre la meilleure qualite d'image
            // console.trace("Selecteur effectif %s", selecteur)
            const loader = loaders[selecteur]
            return loader.load(setSrc, {setFirst: setSrc}, opts)
        },
        unload: async (selecteur) => {
            if(selecteur === 'thumbnail') selecteur = 'thumb'
            if(!selecteur || !labels.includes(selecteur)) selecteur = labelHauteResolution  // Prendre la meilleure qualite d'image
            const loader = loaders[selecteur]
            return loader.unload()
        }
    }

    return loader
}

export function videoResourceLoader(getFichierChiffre, videos, opts) {
    opts = opts || {}
    const supporteWebm = opts.supporteWebm?true:false

    const labels = Object.keys(videos)
    const labelHauteResolution = trouverLabelVideo(labels, {supporteWebm})
    // console.debug("Labels : %O", labels)

    // Generer loaders pour tous les labels (sauf thumbnail)
    const loaders = labels
    .reduce((acc, item)=>{
        const video = videos[item]
        // acc[item] = loadFichierChiffre(getFichierChiffre, video.fuuid_video, video.mimetype, {...opts})
        acc[item] = {
            load: setSrc => {
                const url = [{src: '/collections/streams/' + video.fuuid_video + '/video.webm', type: video.mimetype}]
                if(setSrc) setSrc(url)
                return url
            }, 
            unload: ()=>{
                //console.debug("!!! loader unload")
            }
        } //{fuuid: video.fuuid_video}
        return acc
    }, {})

    const loader = {
        load: async (selecteur, setSrc, opts) => {
            if(!selecteur || !labels.includes(selecteur)) selecteur = labelHauteResolution  // Prendre la meilleure qualite de video
            // console.debug("Loader video %s", selecteur)
            const loader = loaders[selecteur]
            return loader.load(setSrc, null, opts)
        },
        unload: async (selecteur) => {
            // console.debug("!!! unload")
            // if(!selecteur || !labels.includes(selecteur)) selecteur = labelHauteResolution  // Prendre la meilleure qualite de video
            // const loader = loaders[selecteur]
            // return loader.unload()
        }
    }

    return loader
}

// export function videoResourceLoader(getFichierChiffre, videos, opts) {
//     opts = opts || {}
//     const supporteWebm = opts.supporteWebm?true:false

//     const labels = Object.keys(videos)
//     const labelHauteResolution = trouverLabelVideo(labels, {supporteWebm})
//     console.debug("Labels : %O", labels)

//     // Generer loaders pour tous les labels (sauf thumbnail)
//     const loaders = labels
//     .reduce((acc, item)=>{
//         const video = videos[item]
//         acc[item] = loadFichierChiffre(getFichierChiffre, video.fuuid_video, video.mimetype, {...opts})
//         return acc
//     }, {})

//     const loader = {
//         load: async (selecteur, setSrc, opts) => {
//             if(!selecteur || !labels.includes(selecteur)) selecteur = labelHauteResolution  // Prendre la meilleure qualite de video
//             console.debug("Loader video %s", selecteur)
//             const loader = loaders[selecteur]
//             return loader.load(setSrc, null, opts)
//         },
//         unload: async (selecteur) => {
//             if(!selecteur || !labels.includes(selecteur)) selecteur = labelHauteResolution  // Prendre la meilleure qualite de video
//             const loader = loaders[selecteur]
//             return loader.unload()
//         }
//     }

//     return loader
// }