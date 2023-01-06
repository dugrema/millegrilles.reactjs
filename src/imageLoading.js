import { base64 } from 'multiformats/bases/base64'
import path from 'path'
import {trouverLabelImage, trouverLabelVideo, trierLabelsVideos} from './labelsRessources'

const CONST_TIMEOUT_THUMBNAIL_BLOB = 90_000

// Charge un fichier chiffre.
// Utilise un cache/timer pour reutiliser le blob si l'image est chargee/dechargee rapidement.
export function loadFichierChiffre(getFichierChiffre, fuuid, mimetype, opts) {
    // console.debug("!!! loadFichierChiffre fuuid %s, mimetype %s, opts : %O", fuuid, mimetype, opts)
    opts = opts || {}
    const ref_hachage_bytes = opts.ref_hachage_bytes
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
                blobPromise = reloadFichier(getFichierChiffre, fuuid, mimetype, {...opts, ref_hachage_bytes, controller})
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
    const { thumbnail, cles, ref_hachage_bytes, header, format } = opts

    // Preparation du mini-thumbnail (pour fallback ou attente de download) et de l'image pleine grandeur
    let miniLoader = null
    if(thumbnail && thumbnail.data) {
        miniLoader = blobLoader(thumbnail.data, thumbnail.mimetype)
    }
    // if(thumbnail && thumbnail.hachage && thumbnail.data_chiffre) {
    //     const thumbnailFuuid = thumbnail.hachage
    //     const dataChiffre = thumbnail.data_chiffre
    //     miniLoader = loadFichierChiffre(getFichierChiffre, thumbnailFuuid, thumbnail.mimetype, {dataChiffre, cles})
    // }
    const fileLoader = loadFichierChiffre(getFichierChiffre, fichierFuuid, mimetype, {cles, ref_hachage_bytes, header, format})

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
                const blobPret = await miniPromise
                if(setSrc) setSrc(blobPret)
                return blobPret
            }
        },
        unload: async () => {
            if(miniLoader) {
                miniLoader.unload().catch(err=>console.debug("Erreur unload mini thumbnail %s", thumbnailFuuid))
            }
            fileLoader.unload().catch(err=>console.debug("Erreur unload image %s", fichierFuuid))
        }
    }

    return loader
}

export function imageResourceLoader(getFichierChiffre, images, opts) {
    opts = opts || {}
    // console.trace("!!! imageResourceLoader images: %O, opts: %O", images, opts)
    const supporteWebp = opts.supporteWebp===false?false:true
    const anime = opts.anime?true:false
    let { fuuid, mimetype, cles } = opts
    const ref_hachage_bytes = opts.ref_hachage_bytes || fuuid

    const thumbnail = images.thumbnail || images.thumb

    const labels = Object.keys(images)
    const labelHauteResolution = trouverLabelImage(labels, {supporteWebp})
    // console.debug("Labels : %O", labels)

    // Generer loaders pour tous les labels (sauf thumbnail)
    const loaders = labels
    .filter(label=>label!=='thumb'&&label!=='thumbnail')
    .reduce((acc, item)=>{
        const image = images[item]
        const { header, format } = image
        acc[item] = fileResourceLoader(getFichierChiffre, image.hachage, image.mimetype, {thumbnail, cles, ref_hachage_bytes, header, format})
        return acc
    }, {})
    if(fuuid && mimetype) {
        // Loader pour original
        loaders.original = fileResourceLoader(getFichierChiffre, fuuid, mimetype, {thumbnail, ref_hachage_bytes, cles})
    }

    // Ajouter loader de thumbnail
    if(thumbnail) { 
        const thumbnailFuuid = thumbnail.hachage
        if(thumbnail.data) {
            loaders['thumb'] = blobLoader(thumbnail.data, thumbnail.mimetype || 'image/jpg')
        } else {
            loaders['thumb'] = getFaviconLoader()
        }
        // else if(thumbnail.hachage && thumbnail.data_chiffre) {
        //     const thumbnailFuuid = thumbnail.hachage
        //     const dataChiffre = thumbnail.data_chiffre
        //     loaders['thumb'] = loadFichierChiffre(getFichierChiffre, thumbnailFuuid, thumbnail.mimetype, {dataChiffre, cles})
        // }
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
            if(loader) return loader.unload()
        }
    }

    return loader
}

function getFaviconLoader() {
    return {
        load() {
            return '/favicon.ico'
        },
        unload() {}
    }
}

export function videoResourceLoader(videos, opts) {
    opts = opts || {}
    const supporteWebm = opts.supporteWebm?true:false,
          baseUrlVideo = opts.baseUrl || '/collections/streams',
          creerToken = opts.creerToken

    const version_courante = opts.version_courante
    const fuuid = opts.fuuid || version_courante.fuuid

    const labels = Object.keys(videos)
    const selecteurs = [...labels]
    selecteurs.sort(trierLabelsVideos)

    // Generer loaders pour tous les labels (sauf thumbnail)
    const loaders = labels.reduce((acc, item)=>{
        const video = videos[item]
        acc[item] = {
            load: async opts => {
                opts = opts || {}
                const setSrc = opts.setSrc,
                      genererToken = opts.genererToken

                const fuuidVideo = video.fuuid_video
                // console.debug("Load video (individuel) : %O", fuuidVideo)
                let srcVideo = path.join(baseUrlVideo, fuuidVideo)

                if(genererToken === true && creerToken) {
                    const fuuids = [fuuidVideo]
                    const tokensJwts = await creerToken(fuuids)
                    // console.debug("Token (label individuel) cree pour fuuids %O : %O", fuuids, tokensJwts)
                    const tokenJwt = tokensJwts[fuuidVideo]
                    srcVideo = path.join(baseUrlVideo, fuuidVideo) + "?jwt=" + tokenJwt
                }

                const url = [{src: srcVideo, mimetype: video.mimetype, codecVideo: video.codec, label: item}]
                if(setSrc) setSrc(url)
                return url
            }, 
            unload: ()=>{
                //console.debug("!!! loader unload")
            }
        } //{fuuid: video.fuuid_video}
        return acc
    }, {})

    // Loaders speciaux multi-codecs haute (1080/720p), medium (480p), faible(360/270p))
    const buckets = {'haute': {}, 'medium': {}, 'faible': {}}
    let fallbackH264 = ''  // Capture le video h264 de plus faible resolution comme fallback universel
    labels.forEach(label=>{
        const [mimetype, codecVideo, resolution, quality] = label.split(';')
        const resolutionNumber = Number.parseInt(resolution)
        let resolutionTag = ''
        if(resolutionNumber >= 720) resolutionTag = 'haute'
        else if(resolutionNumber < 720 && resolutionNumber >= 480) resolutionTag = 'medium'
        else if(resolutionNumber < 480) resolutionTag = 'faible'
        // Inserer label (selecteur) pour le tag
        if(resolutionTag) {
            if(!buckets[resolutionTag][codecVideo]) {
                buckets[resolutionTag][codecVideo] = label
            }
        }

        if(!fallbackH264 && codecVideo === 'h264' && resolutionNumber <= 360) {
            fallbackH264 = label
        }
    })

    // console.debug("Buckets type video selecteur : %O, fallback", buckets, fallbackH264)
    Object.keys(buckets).forEach(label=>{
        const values = Object.values(buckets[label])
        // console.debug("Map buckets pour label %O = %O", label, values)
        if(values.length > 0) {
            values.sort(trierLabelsVideos)
            selecteurs.unshift(label)
            const url = values.map(labelVideo=>{
                const video = videos[labelVideo]
                const fuuidVideo = video.fuuid_video
                // let srcVideo = path.join(baseUrlVideo, fuuidVideo, 'video.webm')
                let srcVideo = path.join(baseUrlVideo, fuuidVideo)
                return {src: srcVideo, fuuid: fuuidVideo, mimetype: video.mimetype, codecVideo: video.codec, label: labelVideo}
            })
            const loader = {
                load: async opts => {
                    opts = opts || {}
                    const genererToken = opts.genererToken
    
                    // console.debug("Load videos : %O (genererToken?%O)", url, genererToken)

                    if(genererToken === true && creerToken) {
                        const fuuids = url.map(item=>item.fuuid)
                        const tokensJwts = await creerToken(fuuids)
                        // console.debug("Token cree pour fuuids %O : %O", fuuids, tokensJwts)

                        const nouveauUrls = url.map(item=>{
                            // console.debug("Mapper item %O", item)
                            const fuuid = item.fuuid
                            const tokenJwt = tokensJwts[fuuid]
                            // item.src = path.join(baseUrlVideo, item.fuuid, tokenVideo)
                            item.src = path.join(baseUrlVideo, fuuid) + "?jwt=" + tokenJwt
                            item.token = tokenJwt
                            return item
                        })
                        return nouveauUrls
                    }

                    return url
                }, 
                unload: ()=>{
                    //console.debug("!!! loader unload")
                }
            }

            // Ajouter a la liste de loaders
            loaders[label] = loader
        }
    })
    
    // Loader pour l'original (c'est necessairement un video!)
    if(version_courante) {
        const loaderOriginal = {
            load: async opts => {
                opts = opts || {}
                const genererToken = opts.genererToken

                // console.debug("Chargement original avec : %O", version_courante)
                let srcVideo = path.join(baseUrlVideo, fuuid)

                if(genererToken === true && creerToken) {
                    const fuuids = [fuuid]
                    const tokensJwts = await creerToken(fuuids)
                    // console.debug("Token cree pour fuuids %O : %O", fuuids, tokensJwts)
                    const tokenJwt = tokensJwts[fuuid]
                    // srcVideo = path.join(baseUrlVideo, fuuid, tokenVideo)
                    srcVideo = path.join(baseUrlVideo, fuuid) + "?jwt=" + tokenJwt
                }

                const url = [{src: srcVideo, mimetype: version_courante.mimetype, codecVideo: version_courante.codec, label: 'original'}]

                // console.debug("Load videos : %O", url)
                return url
            }, 
            unload: ()=>{
            }
        }

        // Ajouter a la liste de loaders
        loaders['original'] = loaderOriginal
        selecteurs.unshift('original')
    }

    const loader = {
        load: async (selecteur, opts) => {
            // Prendre la plus faible qualite de video si aucune fournie
            if(!selecteur || !selecteurs.includes(selecteur)) {
                if(loaders.faible) selecteur = 'faible'
                else selecteur = 'original'
            }

            // console.debug("Loader video %s", selecteur)
            const loader = loaders[selecteur]

            return loader.load(opts)
        },
        unload: async (selecteur) => {
            // console.debug("!!! unload")
            // if(!selecteur || !labels.includes(selecteur)) selecteur = labelHauteResolution  // Prendre la meilleure qualite de video
            // const loader = loaders[selecteur]
            // return loader.unload()
        },
        getSelecteurs: () => selecteurs
    }

    return loader
}

export function audioResourceLoader(fuuid, opts) {
    opts = opts || {}
    const baseUrlVideo = opts.baseUrl || '/collections/streams',
          version_courante = opts.version_courante || {},
          creerToken = opts.creerToken

    const loaderOriginal = {
        load: async opts => {
            opts = opts || {}
            const genererToken = opts.genererToken

            // console.debug("Chargement original avec : %O", version_courante)
            let srcAudio = path.join(baseUrlVideo, fuuid)

            if(creerToken) {
                const fuuids = [fuuid]
                const tokensJwts = await creerToken(fuuids)
                // console.debug("Token cree pour fuuids %O : %O", fuuids, tokensJwts)
                const tokenJwt = tokensJwts[fuuid]
                // srcVideo = path.join(baseUrlVideo, fuuid, tokenVideo)
                srcAudio = path.join(baseUrlVideo, fuuid) + "?jwt=" + tokenJwt
            }

            const url = [{src: srcAudio, mimetype: version_courante.mimetype, label: 'original'}]

            // console.debug("Load videos : %O", url)
            return url
        }, 
        unload: ()=>{
        }
    }

    return loaderOriginal
}

function blobLoader(data, mimetype) {
    data = base64.decode(data)
    data = new Blob([data], {type: mimetype})
    let urlBlob = null
    return {
        load(setSrc) {
            if(!urlBlob) urlBlob = URL.createObjectURL(data)
            if(setSrc) setSrc(urlBlob)
            return Promise.resolve(urlBlob)
        },
        unload() {
            if(urlBlob) {
                URL.revokeObjectURL(urlBlob)
                urlBlob = null
                return Promise.resolve()
            }
        }
    }
}
