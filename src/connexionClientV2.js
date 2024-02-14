import { io } from 'socket.io-client'
import { FormatteurMessageEd25519 } from '@dugrema/millegrilles.utiljs/src/formatteurMessage'
import { extraireExtensionsMillegrille } from '@dugrema/millegrilles.utiljs/src/forgecommon.js'
import { initialiserFormatteurMessage as initialiserFormatteurMessageChiffrage } from './chiffrageClient'
  
import {init as initX509, verifierCertificat, verifierMessage as x509VerifierMessage} from './x509Client'

import * as hachage from './hachage'  // Wiring hachage pour utiljs
import './chiffrage'

import { KIND_COMMANDE, MESSAGE_KINDS } from '@dugrema/millegrilles.utiljs/src/constantes'

const CONST_TRANSPORTS = ['websocket', 'polling']

class ConnexionSocketio {
    
    constructor() {
        // Parametres de connexion
        this.urlServer = null
        this.params = null

        // io
        this.socket = null

        // Formatteur, signature
        this.formatteurMessage = null

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

    async initialiserFormatteurMessage(certificatPem, clePriveeSign, opts) {
        opts = opts || {}
        if(this.DEBUG) console.debug("initialiserFormatteurMessage PEM:\n%O\n", certificatPem)
        this.formatteurMessage = new FormatteurMessageEd25519(certificatPem, clePriveeSign, {...opts, hacheurs: hachage.hacheurs})
      
        // Initialiser section partagee avec le chiffrageClient
        await initialiserFormatteurMessageChiffrage(certificatPem, clePriveeSign, opts)
      
        await this.formatteurMessage.ready  // Permet de recevoir erreur si applicable
      
        if(this.DEBUG) console.debug("connexionClient.initialiserFormatteurMessage ready")
        if(this.callbackFormatteurMessage) this.callbackFormatteurMessage(true)
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
        this.socket.disconnect()
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

        let request = this.socket.timeout(timeoutDelay)
        if(message) {
            request = request.emitWithAck(eventName, message)
        } else {
            request = request.emitWithAck(eventName)
        }

        const reponse = await request
        if(reponse && reponse.err) throw new Error(reponse.err)  // Erreur cote serveur
        return verifierReponse(reponse, opts)
    }

    async authentifier(data, opts) {
        return authentifier(this, data, opts)
    }

    subscribe(nomEventSocketio, cb, params, opts) {
        return subscribe(this, nomEventSocketio, cb, params, opts)
    }

    unsubscribe(nomEventSocketio, cb, params, opts) {
        return unsubscribe(this, nomEventSocketio, cb, params, opts)
    }

    socketOn(eventName, callback) {
        if(!this.socket) throw new Error('pas configure')
        this.socket.on(eventName, callback)
    }
    
    socketOff(eventName, callback) {
        if( ! this.socket ) {
            throw new Error('pas configure')
        } else if(callback) {
            this.socket.off(eventName, callback)
        } else {
            this.socket.removeAllListeners(eventName)
        }
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
        if(this.setEtatConnexion) this.setEtatConnexion(false, {description: 'Deconnecte normalement'})
        if(this.callbackSetUsager) this.callbackSetUsager('')
    }

    onConnectError(err) {
        console.error("ConnexionSocketio.onConnectError Erreur socket.io : %O", err)
        const { description, context, type } = err
        if(this.setEtatConnexion) {
          this.setEtatConnexion(false, {err: ''+err, type})
        }
        if(this.callbackSetUsager) this.callbackSetUsager('')
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

    // console.debug("connexionClient.onConnect %O", info)
    if(connexion.callbackSetUsager && info && info.nomUsager) {
        // console.debug("connexionClient.onConnect setUsager %s", info.nomUsager)
        await connexion.callbackSetUsager(info.nomUsager)
    }
}

async function authentifier(connexion, data, opts) {
    opts = opts || {}
  
    const DEBUG = connexion.DEBUG

    if(DEBUG) console.debug("reactjs.connexionClient.Authentifier data %O, opts %O", data, opts)
  
    const noCallback = opts.noCallback === true
  
    if(data) {
        const reponse = await connexion.emitWithAck('upgrade', data, {noformat: true})
        if(reponse.nomUsager && connexion.callbackSetUsager) connexion.callbackSetUsager(reponse.nomUsager)
        return reponse
    } else {
        // Faire une requete pour upgrader avec le certificat
        const reponse = await connexion.emitWithAck('genererChallengeCertificat', null, 
            {kind: MESSAGE_KINDS.KIND_REQUETE, noverif: true})
        if(DEBUG) console.debug("reactjs.connexionClient.Authentifier Challenge : ", reponse)
  
        // Repondre pour creer l'upgrade
        const data = {...reponse.challengeCertificat}

        if(DEBUG) console.debug("reactjs.connexionClient.Authentifier Upgrade : ", data)
        const reponseUpgrade = await connexion.emitWithAck('upgrade', data, 
            {kind: MESSAGE_KINDS.KIND_COMMANDE, domaine: 'login', action: 'login', attacherCertificat: true})

        if(DEBUG) console.debug("reactjs.connexionClient.Authentifier Reponse upgrade ", reponseUpgrade)
        if(!noCallback && reponseUpgrade.nomUsager && connexion.callbackSetUsager) {
            connexion.callbackSetUsager(reponseUpgrade.nomUsager)
        }
        
        return reponseUpgrade
    }
}

/**
 * 
 * @param {*} connexion
 * @param {*} nomEventSocketio Nom de l'event correspondant sur le backend de l'application
 * @param {*} cb Callback a invoquer sur chaque message
 * @param {*} params (Optionnel) Obj de parametres pour emitBlocking
 * @param {*} opts (Optionnel) Obj d'options supplementaires pour emitBlocking (e.g. pour signature du message)
 */
async function subscribe(connexion, nomEventSocketio, cb, params, opts) {
    params = params || {}
    opts = opts || {}
    const DEBUG = params.DEBUG || opts.DEBUG
    try {
        // var resultat = await emitBlocking(nomEventSocketio, params, {...opts, noformat: true})
        var resultat = await connexion.emitWithAck(nomEventSocketio, params, 
            {kind: KIND_COMMANDE, ...opts, ajouterCertificat: true})
    } catch(err) {
        // Cas special lors de reconnexion a un serveur qui redemarre
        console.warn("Erreur subscribe %s, attendre 5 secondes et ressayer", nomEventSocketio)
        resultat = await connexion.emitWithAck(nomEventSocketio, params, 
            {kind: KIND_COMMANDE, ...opts, ajouterCertificat: true})
    }
  
    // console.debug("Resultat subscribe %s : %O", nomEventSocketio, resultat)
    if(resultat && resultat.ok === true) {
        resultat.routingKeys.forEach(item=>{
            if(DEBUG) console.debug("subscribe %s Ajouter socketOn %s", nomEventSocketio, item)
            // socketOn(item, cb)  // Note : pas sur pourquoi ca ne fonctionne pas (recoit erreur value)
            connexion.socketOn(item, async event => {
                const message = event.message
                if(message.sig && message.certificat) {
                    const resultat = await x509VerifierMessage(message)
                    // console.debug("Resultat validation : %O", resultat)
                    if(resultat === true) {
                        // Parse le contenu, conserver original
                        let contenu = message
                        if(message.contenu) {
                            // Remplacer event.message par contenu
                            contenu = JSON.parse(message.contenu)
                            contenu['__original'] = message
                            event.message = contenu
                        }
                        try {
                            return cb(event)
                        } catch(err) {
                            console.error("subscribe Erreur callback (1) : ", err)
                        }
                    } else {
                        console.error("subscribe callback Reponse invalide (hachage/signature incorrect) ", message)
                    }
                } else {
                    console.warn("Reponse recue sans signature/cert : ", event)
                    try {
                        return await cb(event)
                    } catch(err) {
                        console.error("subscribe Erreur callback (2) : ", err)
                    }
                }        
            })
        })
    } else {
        const err = new Error(`Erreur subscribe ${nomEventSocketio}`)
        err.reponse = resultat
        throw err
    }
}

/**
 * 
 * @param {*} connexion
 * @param {*} nomEventSocketio Nom de l'event correspondant sur le backend de l'application
 * @param {*} cb Callback a retirer
 */
async function unsubscribe(connexion, nomEventSocketio, cb, params, opts) {
    const DEBUG = connexion.DEBUG
    params = params || {}
    opts = opts || {}
    try {
        connexion.socketOff(nomEventSocketio)
        if(DEBUG) console.debug("unsubscribe %s (params : %O)", nomEventSocketio, params)
        
        const resultat = await connexion.emitWithAck(nomEventSocketio, params, {kind: KIND_COMMANDE, ...opts, ajouterCertificat: true})
        if(DEBUG) console.debug("unsubscribe %s (Resultat : %O)", nomEventSocketio, resultat)

        if(resultat && resultat.ok === true) {
            resultat.routingKeys.forEach(item=>{
                if(DEBUG) console.debug("unsubscribe %s Retirer socketOn %s", nomEventSocketio, item)
                // socketOff(item, cb)
                if(this.socket) {
                    //_socket.off(nomEventSocketio, cb)  // voir subscribe(), on ne peut pas retirer par cb
                    this.socket.removeAllListeners(item)
                }
            })
        }
    } catch(err) {
      console.error("Erreur unsubscribe : %O", err)
    }
}

export class DeconnecteError extends Error {
    constructor (reason) {
      super(reason)
    }
}

// Fonctions complementaires a la connexion

var _certificatsMaitreDesCles = null

async function getCertificatsMaitredescles(connexion) {
    const DEBUG = connexion.DEBUG

    if(DEBUG) console.debug("getCertificatsMaitredescles local ", _certificatsMaitreDesCles)
    if(_certificatsMaitreDesCles) return _certificatsMaitreDesCles
    const reponse = await connexion.emitWithAck('getCertificatsMaitredescles', null, 
        {kind: MESSAGE_KINDS.KIND_REQUETE, noformat: true, noverif: true, ajouterCertificat: true})
    const certificats = []
    
    if(DEBUG) console.debug("getCertificatsMaitredescles Reponse : ", reponse)
    if(!reponse.err) {
        // Valider les certificats recus
        for await (const certificat of reponse) {
            try {
                const forgeCert = await verifierCertificat(certificat)
        
                if(DEBUG) console.debug("Resultat validation : %s", forgeCert!==null)
                if(forgeCert) {
                    const extensionCert = extraireExtensionsMillegrille(forgeCert)
                    const roles = extensionCert.roles || []
                    if(roles.includes('maitredescles')) {
                        certificats.push(certificat)
                    } else {
                        console.warn("Certificat sans role maitredescles, rejete")
                    }
                } else {
                    console.warn("Certificat maitre des cles invalide ", certificat)
                }
            } catch(err) {
                console.error("getCertificatsMaitredescles Erreur validation ", err)
            }
        }
  
      if(certificats.length === 0) {
        console.warn("Aucun certificat de maitre des cles valide n'a ete recu")
        return null
      }
  
      // Conserver la reponse
      if(DEBUG) console.debug("Cert maitre des cles mis en cache : %O", certificats)
      _certificatsMaitreDesCles = certificats
      setTimeout(()=>{
        _certificatsMaitreDesCles = null
        //_timeoutCertificatsMaitreDesCles = null
      }, 300000)  // Clear apres 5 minutes
    }

    return certificats.length>0?certificats:null
}
  
const connexion = new ConnexionSocketio()
const exports = {
    initialiserCertificateStore: caCert => connexion.initialiserCertificateStore(caCert),
    initialiserFormatteurMessage: (certificatPem, clePriveeSign, opts) => connexion.initialiserFormatteurMessage(certificatPem, clePriveeSign, opts),
    configurer: (url, setEtatConnexion, callbackSetUsager, callbackFormatteurMessage, opts) => connexion.configurer(url, setEtatConnexion, callbackSetUsager, callbackFormatteurMessage, opts),
    connecter: () => connexion.connecter(),
    deconnecter: () => connexion.deconnecter,
    emit: () => {throw new Error("fix me")},
    emitWithAck: (eventName, args, opts) => connexion.emitWithAck(eventName, args, opts),
    authentifier: (data, opts) => connexion.authentifier(data, opts),
    getCertificatsMaitredescles: () => getCertificatsMaitredescles(connexion),
    subscribe: (nomEventSocketio, cb, params, opts) => connexion.subscribe(nomEventSocketio, cb, params, opts),
    unsubscribe: (nomEventSocketio, cb, params, opts) => connexion.unsubscribe(nomEventSocketio, cb, params, opts),
}

export default exports
