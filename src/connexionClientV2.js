import { io } from 'socket.io-client'

import { 
        initialiserFormatteurMessage as initialiserFormatteurMessageChiffrage,
        formatterMessage, chargerCleMillegrille, signerMessageCleMillegrille, clearCleMillegrille,
    } from './chiffrageClient'
  
import {init as initX509, verifierCertificat, verifierMessage as x509VerifierMessage} from './x509Client'

import { KIND_COMMANDE, MESSAGE_KINDS } from '@dugrema/millegrilles.utiljs/src/constantes'

const CONST_TRANSPORTS = ['websocket', 'polling']

class ConnexionSocketio {
    
    constructor() {
        // Parametres de connexion
        this.urlServer = null
        this.params = null

        // io
        this.socket = null

        // Debug
        this.DEBUG = true

        // Callbacks
        this.setEtatConnexion = null
        this.callbackSetUsager = null
        this.callbackFormatteurMessage = null
    }

    initialiserCertificateStore(caCert) {
        return initX509(caCert)
    }
      
    /**
     * Configure la connexion avec url et autres parametres.
     * Inclue les fonctions callbacks pour retourner de l'information a l'application
     * 
     * @param {*} url 
     * @param {*} caCert 
     * @param {*} setEtatConnexion 
     * @param {*} callbackSetUsager 
     * @param {*} callbackFormatteurMessage 
     * @param {*} opts 
     */
    configurer(url, setEtatConnexion, callbackSetUsager, callbackFormatteurMessage, opts) {
        opts = opts || {}
        this.setEtatConnexion = setEtatConnexion
        this.callbackSetUsager = callbackSetUsager
        this.callbackFormatteurMessage = callbackFormatteurMessage

        const transports = opts.transports || CONST_TRANSPORTS

        const urlInfo = new URL(url)
        const pathSocketio = urlInfo.pathname
        this.urlServer = `https://${urlInfo.hostname}`

        this.params = {
            path: pathSocketio,
            reconnection: false,
            transports,
        }
        if(opts.reconnectionDelay) {
            this.params.reconnection = true
            this.params.reconnectionDelay = opts.reconnectionDelay
        }

        console.info("ConnexionSocketio Server : %s, Params %O", this.urlServer, this.params)
        this.socket = io(this.urlServer, this.params)

        this.bindSocketioEventHandlers()
    }

    connecter() {
        if(!this.socket) throw new Error('pas configure')
        if(this.socket.connected) return true
        return new Promise((resolve, reject)=>{
            const handlerCallback = err => {
                if(err) return reject(err)
                resolve(true)
            }
            this.socket.connect(handlerCallback)
        })
    }

    deconnecter() {
        if(!this.socket) throw new Error('pas configure')
        return this.socket.disconnect()
    }

    /**
     * Methode principale pour emettre un message vers le serveur. Attend une confirmation/reponse.
     * Le message tranmis est signe localement (sauf si inhibe) et la signature de la reponse est verifiee.
     * @param {*} eventName 
     * @param {*} args 
     * @param {*} opts 
     * @returns 
     */
    async emitWithAck(eventName, args, opts) {
        opts = opts || {}
        if(!this.socket) throw new Error('pas configure')
        if(!eventName) throw new TypeError('connexionClient.emitWithAck event null')

        const timeoutDelay = opts.timeout || 9000,
              attachements = opts.attachements,
              overrideConnecte = opts.overrideConnecte || false

        if(!overrideConnecte && !this.socket.connected) throw new DeconnecteError("connexionClient.emitWithAck Deconnecte")

        let message = await signerMessage(this.formatteurMessage, args, opts)
        if(attachements) {
            message = {...message, ...attachements}
        }

        const reponse = await this.socket.timeout(timeoutDelay).emitWithAck(eventName, message)
        if(reponse && reponse.err) throw new Error(reponse.err)  // Erreur cote serveur
        return verifierReponse(reponse, opts)
    }

    bindSocketioEventHandlers() {
        this.socket.on('connect', () => this.onConnect())
        this.socket.io.on('reconnect_attempt', () => this.onReconnectAttempt())
        this.socket.io.on('reconnect', () => this.onReconnect())
        this.socket.on('disconnect', reason => this.onDisconnect(reason))
        this.socket.on('connect_error', err => this.onConnectError(err))
    }

    onConnect() {
        if(this.DEBUG) console.debug("Connecte")
        onConnectHandler(this).catch(err=>{console.error("Erreur handling onConnect ", err)})
    }

    onReconnectAttempt() {
        if(this.DEBUG) console.debug("Tentative de reconnexion")
    }

    onReconnect() {
        if(this.DEBUG) console.debug("Reconnecte")
    }

    onDisconnect(reason) {
        if(this.DEBUG) console.debug("ConnexionSocketio.onDisconnect Disconnect socket.io (reason: %O)", reason)
    }

    onConnectError(err) {
        console.error("ConnexionSocketio.onConnectError Erreur socket.io : %O", err)
    }
    
}

async function signerMessage(formatteurMessage, message, opts) {
    if( message && !message['sig'] && opts.noformat !== true ) {
        const kind = message.kind || opts.kind
        if(kind) {
            if(!formatteurMessage) throw new Error("connexionClient.signerMessage Formatteur de message non initialise")
            message = await formatteurMessage.formatterMessage(kind, message, opts)
            // console.debug("connexionClient.emitBlocking Message signe ", message)
        } else {
            throw new Error('Il faut fournir opts.kind')
        }
    }
    return message
}

async function verifierReponse(reponse, opts) {
    opts = opts || {}

    if(opts.noverif) {
        // Aucune verification ou parsing de la reponse
        return reponse
    }

    if(reponse.sig && reponse.certificat) {
        const resultat = await x509VerifierMessage(reponse)
        // console.debug("Resultat validation : %O", resultat)
        if(resultat === true) {
            // Parse le contenu, conserver original
            let contenu = reponse
            if(reponse.contenu) {
                contenu = JSON.parse(reponse.contenu)
                contenu['__original'] = reponse
            }
            return contenu
        } else {
            throw new Error("Reponse invalide (hachage/signature incorrect)")
        }
    } else {
        //console.warn("Reponse recue sans signature/cert : ", reponse)
        // return reponse
        throw new Error("Reponse invalide (signature absente)")
    }    
}

async function onConnectHandler(connexion, opts) {
    opts = opts || {}
    const reconnecte = opts.reconnecte || false

    // Pour la premiere connexion, infoPromise est le resultat d'une requete getEtatAuth.
    const info = await connexion.emitWithAck(
        'getEtatAuth', {}, {noformat: true, noverif: true, overrideConnecte: true})
    
    // console.debug("Reconnect info recu, marquer connecte : ", info)
    if(connexion.setEtatConnexion) {
        await connexion.setEtatConnexion(true, {reconnecte})
    }

    console.debug("connexionClient.onConnect %O", info)
    if(connexion.callbackSetUsager && info && info.nomUsager) {
        // console.debug("connexionClient.onConnect setUsager %s", info.nomUsager)
        await connexion.callbackSetUsager(info.nomUsager)
    }
}

const connexion = new ConnexionSocketio()
const exports = {
    initialiserCertificateStore: caCert => connexion.initialiserCertificateStore(caCert),
    configurer: (url, setEtatConnexion, callbackSetUsager, callbackFormatteurMessage, opts) => connexion.configurer(url, setEtatConnexion, callbackSetUsager, callbackFormatteurMessage, opts),
    connecter: () => connexion.connecter(),
    deconnecter: () => connexion.deconnecter,
    emitWithAck: (eventName, args, opts) => connexion.emitWithAck(eventName, args, opts),
}

export default exports
