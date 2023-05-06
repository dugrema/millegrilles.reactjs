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

/** Download une image chiffree. */
function imageLoader(fuuid) {
    return {
        load: (opts) => {
            return Promise.resolve()
        },
        unload: () => {
            return Promise.resolve()
        }
    }
}

/** Prepare un fichier audio pour le streaming. */
function audioLoader(fuuid) {
    return {
        load: (opts) => {
            return Promise.resolve()
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

class MediaLoader {

    constructor(urlMapper, getCleSecrete) {
        // Methode avec parametres (fuuid)
        this.urlMapper = urlMapper
        
        // Methode avec parametres (data, opts: {mimetype, cle_id, header, cle_secrete}) -> Promise(Blob)
        // Data peut etre string (multibase), Buffer, ArrayBuffer/View, Blob

        // Methode avec parametres (cle_id)
        this.getCleSecrete = getCleSecrete
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
            // signal,  // Bug sur iOS
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

        let data = null,
            header = opts.header

        if(data_chiffre) {
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

        return this.dechiffrer(data, cle_secrete, header, mimetype)
    }

    /**
     * @param fuuid Identificateur de fichier
     * @param opts {cle_secrete, cle_id, header, progress, delay, callbackOnClean}
     * @returns Retourne {loader, unloader} pour le fuuid specifie.
     */
    fichierLoader(fuuid, opts) {
        opts = opts || {}
        const processeur = optsProcesseur => this.processeur(optsProcesseur)
        return fichierDownloader(processeur, fuuid, opts)
    }
}

export default MediaLoader
