/* Remplacement version 2023.5 pour imageLoading.js */
import { base64 } from 'multiformats/bases/base64'
import axios from 'axios'
import { chiffrage } from './chiffrage'

const CONST_TIMEOUT_THUMBNAIL_BLOB = 90_000,
      CONST_TIMEOUT_DOWNLOAD = 300_000

/** Loader/unloader pour blob encode en multibase base64*/
function blobPromiseLoader(data, mimetype) {
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

/** Download un un fichier chiffre. Utilise pour afficher un fichier directement (e.g. PDF). */
function fichierDownloader(processeur, fuuid, opts) {
    opts = opts || {}
    const { delay, callbackOnClean } = opts
    const timeoutBlob = opts.timeout || CONST_TIMEOUT_THUMBNAIL_BLOB

    let blobPromise = null
    let timeoutCleanup = null
    let controller = null

    return {
        load: async (optsLoad) => {
            optsLoad = optsLoad || {}

            const { setSrc } = optsLoad

            if(!blobPromise) {
                if(controller) controller.abort() // S'assurer d'annuler un download en limbo
                controller = new AbortController()
                blobPromise = processeur({...opts, ...optsLoad, fuuid, controller})
            } else if(timeoutCleanup) {
                clearTimeout(timeoutCleanup)
                timeoutCleanup = null
            }

            try {
                var urlBlob = await blobPromise
                if(delay) await new Promise(resolve=>(setTimeout(resolve, delay)))
                if(setSrc) setSrc(urlBlob)
                return urlBlob
            } catch(err) {
                // Cleanup
                blobPromise = null
                if(urlBlob) URL.revokeObjectURL(urlBlob)
                throw err
            } finally {
                controller = null
            }

        },
        unload: async () => {
            // console.trace("Unload ", opts)
            if(controller) {
                controller.abort()
                controller = null
            }
            if(blobPromise) {
                try {
                    const urlBlob = await blobPromise
                    if(urlBlob) {
                        timeoutCleanup = setTimeout(()=>{
                            URL.revokeObjectURL(urlBlob)
                            blobPromise = null  // Vider promise, permet un reload
                            timeoutCleanup = null
                            if(callbackOnClean) callbackOnClean()
                        }, timeoutBlob)
                    }
                } catch(err) {
                    blobPromise = null  // Vider promise, permet un reload
                    if(callbackOnClean) callbackOnClean()
                }
            }
        }
    }
}

/** Charger des thumbnails avec fallbacks. */
function thumbnailLoader(processeur, images, opts) {
    opts = opts || {}

    // Charger thumb et small si disponible.
    const { thumb, small } = images

    // console.debug("ThumthumbnailLoader preparer loaders images:%O, opts:%O", images, opts)

    // Preparer loaders en reutilisant fichierDownloader -> {load, unload}
    let thumbLoader = null, smallLoader = null
    if(thumb) {
        const { data, data_chiffre, header, mimetype } = thumb
        const parametres = {...opts, data, data_chiffre, header, mimetype}
        // console.debug("thumbnailLoader Parametres thumb ", parametres)
        thumbLoader = fichierDownloader(processeur, null, parametres)
    }
    if(small) {
        const { hachage: fuuid, header, mimetype } = small
        const parametres = {...opts, header, mimetype}
        // console.debug("thumbnailLoader Parametres small %s : %O ", fuuid, parametres)
        smallLoader = fichierDownloader(processeur, fuuid, parametres)
    }

    return {
        load: async (optsLoad) => {
            optsLoad = optsLoad || {}

            const { thumb_only } = optsLoad

            const promises = []
            let thumbPromise = null,
                smallPromise = null
            if(thumbLoader) {
                thumbPromise = thumbLoader.load(optsLoad)
                promises.push(thumbPromise)
            }
            if(smallLoader && !thumb_only) {
                smallPromise = smallLoader.load(optsLoad)
                promises.push(smallPromise)
            }

            try {
                // Attendre le premier blob qui est pret
                const blobPret = await Promise.any(promises)
                if(optsLoad.setFirst) optsLoad.setFirst(blobPret)
            } catch(err) {
                console.warn("thumbnailLoader Erreur chargement images ", err)
            }

            try {
                if(smallPromise) return await smallPromise
            } catch(err) {
                console.warn("thumbnailLoader Erreur chargement small ", err)
            }

            // Fallback sur thumbnail
            return await thumbPromise
        },
        unload: async () => {
            if(thumbLoader) thumbLoader.unload().catch(err=>console.warn("thumbnailLoader Erreur unload thumbnail ", err))
            if(smallLoader) smallLoader.unload().catch(err=>console.warn("thumbnailLoader Erreur unload small ", err))
        }
    }

}

/** Download une image chiffree. */
function imageLoader(processeur, images, opts) {

    const { anime, fuuid, mimetype } = opts
    // console.debug("imageLoader opts", opts)

    const thumbLoader = thumbnailLoader(processeur, images, opts)

    let imageLoader = null
    if(anime === true && fuuid && mimetype) {
        const parametres = {...opts, mimetype}
        imageLoader = fichierDownloader(processeur, fuuid, parametres)
    } else {
        // console.debug("Images ", images)
        const imageMax = Object.values(images).reduce((acc, item)=>{
            if(!acc.resolution || acc.resolution < item.resolution) return item
            return acc
        }, {})
        
        // console.debug("Image max : %O", imageMax)
        if(imageMax) {
            const { hachage: fuuid, header, mimetype } = imageMax
            const parametres = {...opts, header, mimetype}
            imageLoader = fichierDownloader(processeur, fuuid, parametres)
        }
    }

    return {
        load: async (optsLoad) => {
            try {
                optsLoad = optsLoad || {}
                // console.debug("!!! Opts %O, OptsLoad %O", opts, optsLoad)

                const imagePromise = imageLoader.load(optsLoad)

                const setterRace = optsLoad.setFirst || optsLoad.setThumbnail
                if(setterRace) {
                    const thumbnailPromise = thumbLoader.load(optsLoad)
                    const promises = [thumbnailPromise, imagePromise]
                    const blobFirst = await Promise.any(promises)
                    // console.debug("setterRace set ", blobFirst)
                    setterRace(blobFirst)
                }

                return await imagePromise
            } catch(err) {
                if(optsLoad.erreurCb) erreurCb(err)
                else throw err
            }
        },
        unload: async () => {
            thumbLoader.unload().catch(err=>console.error("imageLoader unload thumbnail Erreur : ", err))
            imageLoader.unload().catch(err=>console.error("imageLoader unload image Erreur : ", err))
        }
    }
}

/** Prepare un fichier audio pour le streaming. */
function audioLoader(getUrl, creerTokenJwt, fuuid, mimetype, opts) {
    opts = opts || {}

    return {
        load: async (optsLoader) => {
            optsLoader = optsLoader || {}
            const jwt = await creerToken(creerTokenJwt, fuuid, fuuid, mimetype)
            console.debug("Token cree : ", jwt)
            const srcAudio = getUrl(fuuid, {jwt})
            console.debug("URL Audio : ", srcAudio)
            const url = [{src: srcAudio, mimetype}]
            return url
        },
        unload: () => {
            return Promise.resolve()
        }
    }
}

/** Prepare un video pour streaming et son poster (image). 
 *  Combine le comportement image (download blob) et audio (streaming). */
function videoLoader(fuuid) {
    return {
        load: (opts) => {
            return Promise.resolve()
        },
        unload: () => {
            return Promise.resolve()
        }
    }
}

async function creerToken(creerTokenJwt, fuuidFichier, fuuidStream, mimetype) {
    const fuuids = [fuuidFichier]
    const commande = {
        fuuids,
        fuuidMedia: fuuidStream,
        mimetype,
    }
    const reponse = await creerTokenJwt(commande)
    
    console.debug("Reponse tokens JWTs : ", reponse)
    return reponse.jwts[fuuidStream]
}

class MediaLoader {

    constructor(urlMapper, getCleSecrete, creerTokenJwt) {
        // Methode avec parametres (fuuid)
        this.urlMapper = urlMapper
        
        // Methode avec parametres (data, opts: {mimetype, cle_id, header, cle_secrete}) -> Promise(Blob)
        // Data peut etre string (multibase), Buffer, ArrayBuffer/View, Blob

        // Methode avec parametres (cle_id)
        this.getCleSecrete = getCleSecrete

        this.creerTokenJwt = creerTokenJwt
    }

    async downloader(fuuid, opts) {
        opts = opts || {}
        const { controller, progress } = opts
        
        const url = this.urlMapper(fuuid)
        // console.debug("Download %O, (opts: %O)", url, opts)

        const signal = controller?controller.signal:null

        // Recuperer le fichier
        const reponse = await axios({
            method: 'GET',
            url,
            responseType: 'arraybuffer',
            timeout: CONST_TIMEOUT_DOWNLOAD,
            progress,
            // signal,  // Bug sur dev - react useEffect() calle 2 fois
        })

        return Buffer.from(reponse.data)
    }

    async dechiffrer(data, cle_secrete, header, mimetype) {
        // console.debug("Dechiffrer : data=%O, cle_secrete=%O, header=%O, mimetype=%O", data, cle_secrete, header, mimetype)
        const ab = await chiffrage.dechiffrer(cle_secrete, data, {header})
        // console.debug("Data dechiffre OK")
        const blob = new Blob([ab], {type: mimetype})
        // console.debug("dechiffrer Blob resultat ", blob)
        return URL.createObjectURL(blob)
    }

    /**
     * Dechiffre un fichier. Downloade le fichier si fuuid est fourni.
     * 
     * @param opts {fuuid, data_chiffre, cle_id, header, progress}
     * @returns Blob dechiffre
     */
    async processeur(opts) {
        opts = opts || {}
        const { fuuid, data_chiffre, mimetype } = opts

        let data = opts.data,
            header = opts.header

        if(data) {
            // On a le data direct (e.g. thumbnail)
            const dataAb = base64.decode(data)
            const blob = new Blob([dataAb], {type: mimetype})
            return URL.createObjectURL(blob)
        } else if(data_chiffre) {
            if(typeof(data_chiffre) !== 'string') throw new Error('data_chiffre - doit etre string multibase en base64')
            data = base64.decode(data_chiffre)
        } else if(fuuid) {
            data = await this.downloader(fuuid, opts)
        } else {
            throw new Error('Il faut fournir fuuid ou data_chiffre')
        }

        let cle_secrete = opts.cle_secrete
        if(!cle_secrete) {
            let cle_id = opts.cle_id || fuuid
            if(!cle_id) throw new Error("MediaLoader.processeur Il faut fournir cle_secrete/header, cle_id ou fuuid")
            // console.debug("Charger cle secrete : ", cle_id)

            const cle = await this.getCleSecrete(cle_id)
            // console.debug("Cle recue : %O", cle)
            cle_secrete = cle.cleSecrete
            if(!header) header = cle.header
        } else if(header) {  
            // On a cle secrete et header - OK
        } else {
            throw new Error("MediaLoader.processeur Il faut fournir cle_secrete/header, cle_id ou fuuid")
        }

        // console.debug("processeur Dechiffrer data %O, cle_secrete: %O, header: %O, mimetype: %O", data, cle_secrete, header, mimetype)

        return this.dechiffrer(data, cle_secrete, header, mimetype)
    }

    /**
     * @param fuuid Identificateur de fichier
     * @param opts {cle_secrete, cle_id, header, progress, delay, callbackOnClean}
     * @returns Retourne {loader, unloader} pour le fuuid specifie.
     */
    fichierLoader(fuuid, opts) {
        opts = opts || {}
        const processeur = optsProcesseur => this.processeur(optsProcesseur)  // Bind this pour le processeur 
        return fichierDownloader(processeur, fuuid, opts)
    }

    thumbnailLoader(images, opts) {
        opts = opts || {}
        if(!images) throw new Error("MediaLoader.thumbnailLoader Aucunes images fournies")

        if(opts.cle_secrete) {
            // OK
        } else if(opts.cle_id) {
            // OK
        } else {
            throw new Error("MediaLoader.thumbnailLoader Il faut fournir cle_secrete ou cle_id")
        }

        if(Object.keys(images) === 0) throw new Error('MediaLoader.thumbnailLoader Dict images est vide')

        const processeur = optsProcesseur => this.processeur(optsProcesseur)  // Bind this pour le processeur 
        return thumbnailLoader(processeur, images, opts)
    }

    imageLoader(images, opts) {
        opts = opts || {}
        if(!images) throw new Error("MediaLoader.imageLoader Aucunes images fournies")

        if(opts.cle_secrete) {
            // OK
        } else if(opts.cle_id) {
            // OK
        } else {
            throw new Error("MediaLoader.imageLoader Il faut fournir cle_secrete ou cle_id")
        }

        if(Object.keys(images) === 0) throw new Error('MediaLoader.imageLoader Dict images est vide')

        const processeur = optsProcesseur => this.processeur(optsProcesseur)  // Bind this pour le processeur 
        return imageLoader(processeur, images, opts)
    }

    audioLoader(fuuid, mimetype, opts) {
        opts = opts || {}
        if(!fuuid || !mimetype) throw new Error('Fuuid ou mimetype manquant')
        const getUrl = (fuuid, opts) => this.urlMapper(fuuid, opts)
        const creerTokenJwt = (...params) => this.creerTokenJwt(...params)
        return audioLoader(getUrl, creerTokenJwt, fuuid, mimetype, {...opts, cle_id: fuuid})
    }

}

export default MediaLoader
