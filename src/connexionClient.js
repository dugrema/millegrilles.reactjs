import {io as openSocket} from 'socket.io-client'
import { FormatteurMessageEd25519 } from '@dugrema/millegrilles.utiljs/src/formatteurMessage'
import { extraireExtensionsMillegrille } from '@dugrema/millegrilles.utiljs/src/forgecommon.js'

import * as hachage from './hachage'  // Wiring hachage pour utiljs
import './chiffrage'

import { 
  initialiserFormatteurMessage as initialiserFormatteurMessageChiffrage,
  formatterMessage, chargerCleMillegrille, signerMessageCleMillegrille, clearCleMillegrille,
} from './chiffrageClient'

import {
  init as initX509,
  verifierCertificat,
  verifierMessage as x509VerifierMessage,
} from './x509Client'
import { KIND_COMMANDE, MESSAGE_KINDS } from '@dugrema/millegrilles.utiljs/src/constantes'

// Re-exporter fonctions de chiffrageClient
export { formatterMessage, chargerCleMillegrille, signerMessageCleMillegrille, clearCleMillegrille } 

const { hacherCertificat: _hacherCertificat } = hachage

let _socket = null,
    _formatteurMessage = null,
    _connecteUneFois = false,
    _connexionCourante = null,
    _connecxionInitialePromise = null

let _callbackSetEtatConnexion,
    _callbackSetUsager,
    _callbackFormatteurMessage,
    _urlCourant = '',
    _connecte = false,
    _certificatsMaitreDesCles = ''
   
export function setCallbacks(setEtatConnexion, callbackSetUsager, callbackFormatteurMessage) {
  _callbackSetEtatConnexion = setEtatConnexion
  _callbackSetUsager = callbackSetUsager
  _callbackFormatteurMessage = callbackFormatteurMessage
}

export async function initialiserCertificateStore(caCert, opts) {
  opts = opts || {}
  const DEBUG = opts.DEBUG
  if(DEBUG) console.debug("Initialisation du CertificateStore avec %O", caCert)
  return initX509(caCert)
}

export function estActif() {
  return _urlCourant && _socket && _connecte
}

export async function connecter(urlApp, opts) {
  opts = opts || {}

  if(urlApp === _urlCourant) return

  if(estActif()) {
    console.info("connexionClient.connecter() Connexion deja active, rien a faire")
    return _socket
  }

  const urlSocketio = new URL(urlApp)
  // urlSocketio.pathname = path.join(urlSocketio.pathname, 'socket.io')
  if(opts.DEBUG) console.debug("Socket.IO connecter avec url %s", urlSocketio.href)

  const connexion = connecterSocketio(urlSocketio.href, opts)
  if(_connexionCourante) {
    const connexionPrecedente = _connexionCourante
    _connexionCourante = connexion
    try {
      // S'assurer de faire le cleanup de la connexion precedente
      connexionPrecedente.disconnect().catch(err=>console.warn("Erreur deconnexion connexion remplacee (1) : %O", err))
    } catch(err) {
      console.warn("Erreur deconnexion connexion remplacee (2) : %O", err)
    }
  }

  socketOn('connect', () => {
    if(opts.DEBUG) console.debug("socket.io connecte a %O", urlSocketio)
    _connecte = true
    _urlCourant = urlApp
    _callbackSetEtatConnexion(_connecte)
    onConnect(connexion).catch(err=>console.error("connexionClient.onConnect ERROR %O", err))
  })
  socketOn('reconnect', () => {
    if(opts.DEBUG) console.debug("Reconnecte")
    _connecte = true
    onConnect().catch(err=>console.error("connexionClient.onConnect ERROR %O", err))
  })
  socketOn('disconnect', reason => {
    if(opts.DEBUG) console.debug("Disconnect socket.io (reason: %O)", reason)
    _connecte = false
    if(_callbackSetEtatConnexion) _callbackSetEtatConnexion(false)
    if(_callbackSetUsager) _callbackSetUsager('')
  })
  socketOn('connect_error', err => {
    console.error("connexionClient Erreur socket.io : %O", err)
    _connecte = false
    if(_callbackSetEtatConnexion) _callbackSetEtatConnexion(false)
    if(_callbackSetUsager) _callbackSetUsager('')
  })

  return connexion
}

export function getCertificatFormatteur() {
  return {
    // certificat: _formatteurMessage.cert,
    fingerprint: _formatteurMessage.fingerprint,
    extensions: extraireExtensionsMillegrille(_formatteurMessage.cert)
  }
}

// Charger et conserver information backend de l'usager
export async function onConnect(infoPromise) {
  // Pour la premiere connexion, infoPromise est le resultat d'une requete getEtatAuth.
  let info = null
  if(_connecxionInitialePromise) _connecxionInitialePromise.resolve()
  if(infoPromise) {
    // console.debug("connexionClient.onConnect Connexion initiale (getEtatAuth)")
    _connecteUneFois = true
    info = await infoPromise
  } else {
    // Connexion subsequente, il faut faire une requete emitBlocking pour info session
    info = await emitBlocking('getEtatAuth', {}, {noformat: true})
    // console.debug("Reconnect info recu, marquer connecte : ", info)
    if(_callbackSetEtatConnexion) _callbackSetEtatConnexion(_connecte, {reconnecte: true})
  }

  console.debug("connexionClient.onConnect %O", info)
  if(_callbackSetUsager && info.nomUsager) {
    // console.debug("connexionClient.onConnect setUsager %s", info.nomUsager)
    _callbackSetUsager(info.nomUsager)
      .catch(err=>{
        console.error("connexionClient.onConnect Erreur _callbackSetUsager : %O", err)
      })
  }
}

async function connecterSocketio(url, opts) {
  opts = opts || {}
  const DEBUG = opts.DEBUG

  // Garder polling en premier (upgrade websocket automatique)
  // Android a un probleme avec websocket
  const transports = opts.transports || ['websocket', 'polling']

  if( _socket ) {
    console.debug("SOCKET EXISTANT : %O", _socket)
    const precedent = _socket
    try {
      precedent.disconnect().catch(err=>console.warning("connecterSocketio Erreur deconnexion socket predecent (1) : %O", err))
    } catch(err) {
      console.warning("connecterSocketio Erreur deconnexion socket predecent (2) : %O", err)
    }
  }

  const urlInfo = new URL(url)
  const hostname = 'https://' + urlInfo.host
  const pathSocketio = urlInfo.pathname

  if(DEBUG) console.debug("Connecter socket.io sur %s (opts: %O)", url, opts)
  const paramsSocketIo = {
    path: pathSocketio,
    reconnection: false,
    transports,
  }
  if(opts.reconnectionDelay) {
    paramsSocketIo.reconnection = true
    paramsSocketIo.reconnectionDelay = opts.reconnectionDelay
  }
  _socket = openSocket(hostname, paramsSocketIo)

  console.info("connexionClient _socket ouvert : ", _socket)

  let promiseMethods = null
  try {
    // Attendre la confirmation de connexion pour faire appel getEtatAuth
    // Permet d'utiliser la reconnexion transparent de session avec le 
    // cookie de session (mgcookie) de webauth
    await new Promise((resolve, reject) => {
      if(_connecxionInitialePromise) { _connecxionInitialePromise.reject('reconnecting')}
      const timeout = setTimeout(()=>reject('timeout'), 15_000)  // Attendre confirmation de connexion max 15 secondes
      promiseMethods = {resolve, reject, timeout}
      _connecxionInitialePromise = promiseMethods
    })

    try {
      return await emitBlocking('getEtatAuth', {}, {timeout: 2500, noformat: true})
    } catch(err) {
      return {ok: false, err: 'getEtatAuth: '+err}
    }
  } catch(err) {
    console.error("Erreur de connexion : %O", err)
  } finally {
    if(promiseMethods && promiseMethods.timeout) clearTimeout(promiseMethods.timeout)
    _connecxionInitialePromise = null
  }

}

export async function initialiserFormatteurMessage(certificatPem, clePriveeSign, opts) {
  opts = opts || {}
  const DEBUG = opts.DEBUG
  if(DEBUG) console.debug("initialiserFormatteurMessage PEM:\n%O\n", certificatPem)
  _formatteurMessage = new FormatteurMessageEd25519(certificatPem, clePriveeSign, {...opts, hacheurs: hachage.hacheurs})

  // Initialiser section partagee avec le chiffrageClient
  await initialiserFormatteurMessageChiffrage(certificatPem, clePriveeSign, opts)

  await _formatteurMessage.ready  // Permet de recevoir erreur si applicable

  if(DEBUG) console.debug("connexionClient.initialiserFormatteurMessage ready")
  if(_callbackFormatteurMessage) _callbackFormatteurMessage(true)
}

export function socketOn(eventName, callback) {
  if(!_socket) {
    console.error("socketOn %s, _socket === null", eventName)
    if(callback) callback(false)
    return
  }
  _socket.on(eventName, callback)
}

export function socketOff(eventName, callback) {
  // console.debug("socketOff !!! Retrait evenement %O avec callback %O", eventName, callback)
  if( ! _socket ) {
    return false
  } else if(callback) {
    _socket.off(eventName, callback)
  } else {
    _socket.removeAllListeners(eventName)
  }
}

export function deconnecter() {
  /* Deconnecte et retire les information de l'usager */
  if(_socket !== null) {
    _socket.disconnect()
    _socket = null
  } else {
    console.warn("_socket n'est pas initialise, on ne peut pas deconnecter")
  }
  _formatteurMessage = null
  if(_callbackFormatteurMessage) _callbackFormatteurMessage(false)
}

export function reconnecter() {
  if(_socket !== null) {
    if(_socket && _socket.connected) {
      _socket.disconnect()
    }
    _socket.connect()
  }
}

export async function verifierMessage(message) {
  return x509VerifierMessage(message)
}

export async function emitBlocking(event, message, opts) {
  /* Emet un message et attend la reponse. */
  opts = opts || {}
  const timeoutDelay = opts.timeout || 9000,
        attachements = opts.attachements

  if(!event) throw new TypeError('connexionClient.emitBlocking event null')
  // if(!message) throw new TypeError('connexionClient.emitBlocking message null')

  if( message && !message['sig'] && opts.noformat !== true ) {
    // Signer le message
    const kind = message.kind || opts.kind
    if(kind) {
      if(!_formatteurMessage) throw new Error("connexionClient.emitBlocking Formatteur de message non initialise")
      message = await _formatteurMessage.formatterMessage(kind, message, opts)
      // console.debug("connexionClient.emitBlocking Message signe ", message)
    } else {
      throw new Error('Il faut fournir opts.kind')
    }
  }

  return new Promise( (resolve, reject) => {

    // Creer timeout pour echec de commande
    const timeout = setTimeout(_=>{
      reject(new Error('emitBlocking ' + event + ': Timeout socket.io'))
    }, timeoutDelay)

    const traiterReponse = reponse => {
      clearTimeout(timeout)  // Reponse recue, annuler le timeout

      // console.debug("emitBlocking traiterReponse ", reponse)

      if(reponse && reponse.err) return reject(reponse.err)  // Erreur cote serveur

      if(reponse.sig && reponse.certificat) {
        x509VerifierMessage(reponse)
          .then(resultat=>{
            // console.debug("Resultat validation : %O", resultat)
            if(resultat === true) {
              // Parse le contenu, conserver original
              let contenu = reponse
              if(reponse.contenu) {
                contenu = JSON.parse(reponse.contenu)
                contenu['__original'] = reponse
              }
              resolve(contenu)
            }
            reject("Reponse invalide (hachage/signature incorrect)")
          })
          .catch(err=>{
            console.error("Erreur validation reponse  %O : %O", reponse, err)
            reject(err)
          })
      } else {
        //console.warn("Reponse recue sans signature/cert : ", reponse)
        resolve(reponse)
      }
    }

    if(message) {
      // Injecter attachments si applicable
      if(attachements) message = {...message, attachements}
      // Emettre message
      _socket.emit(event, message, traiterReponse)
    } else {
      _socket.emit(event, traiterReponse)
    }

  })
}

export async function emit(event, message, opts) {
  /* Emet un message sans attente (fire and forget) */
  opts = opts || {}

  if( message && !message['sig'] && opts.noformat !== true ) {
    // Signer le message
    // try {
      const kind = message.kind || opts.kind
      if(!kind) {
        throw new Error('Il faut fournir opts.kind')
      }
      message = await _formatteurMessage.formatterMessage(kind, message, opts)
    // } catch(err) {
    //   console.warn("Erreur formattage message : %O", err)
    // }
  }

  if(message) {
    _socket.emit(event, message)
  } else {
    _socket.emit(event)
  }
}

/**
 * 
 * @param {*} nomEventSocketio Nom de l'event correspondant sur le backend de l'application
 * @param {*} cb Callback a invoquer sur chaque message
 * @param {*} params (Optionnel) Obj de parametres pour emitBlocking
 * @param {*} opts (Optionnel) Obj d'options supplementaires pour emitBlocking (e.g. pour signature du message)
 */
export async function subscribe(nomEventSocketio, cb, params, opts) {
  params = params || {}
  opts = opts || {}
  const DEBUG = params.DEBUG || opts.DEBUG
  try {
    // var resultat = await emitBlocking(nomEventSocketio, params, {...opts, noformat: true})
    var resultat = await emitBlocking(nomEventSocketio, params, {kind: KIND_COMMANDE, ...opts, ajouterCertificat: true})
  } catch(err) {
    // Cas special lors de reconnexion a un serveur qui redemarre
    console.warn("Erreur subscribe %s, attendre 5 secondes et ressayer", nomEventSocketio)
    // resultat = await emitBlocking(nomEventSocketio, params, {...opts, noformat: true})
    resultat = await emitBlocking(nomEventSocketio, params, {kind: KIND_COMMANDE, ...opts, ajouterCertificat: true})
  }

  // console.debug("Resultat subscribe %s : %O", nomEventSocketio, resultat)
  if(resultat && resultat.ok === true) {
    resultat.routingKeys.forEach(item=>{
      if(DEBUG) console.debug("subscribe %s Ajouter socketOn %s", nomEventSocketio, item)
      // socketOn(item, cb)  // Note : pas sur pourquoi ca ne fonctionne pas (recoit erreur value)
      socketOn(item, async event => {
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
 * @param {*} nomEventSocketio Nom de l'event correspondant sur le backend de l'application
 * @param {*} cb Callback a retirer
 */
export async function unsubscribe(nomEventSocketio, cb, params, opts) {
  try {
    params = params || {}
    opts = opts || {}
    const DEBUG = params.DEBUG || opts.DEBUG
    socketOff(nomEventSocketio)
    if(DEBUG) console.debug("unsubscribe %s (params : %O)", nomEventSocketio, params)
    const resultat = await emitBlocking(nomEventSocketio, params, {kind: KIND_COMMANDE, ...opts, ajouterCertificat: true})
    if(DEBUG) console.debug("unsubscribe %s (Resultat : %O)", nomEventSocketio, resultat)
    if(resultat && resultat.ok === true) {
      resultat.routingKeys.forEach(item=>{
        if(DEBUG) console.debug("unsubscribe %s Retirer socketOn %s", nomEventSocketio, item)
        // socketOff(item, cb)
        if(_socket) {
          //_socket.off(nomEventSocketio, cb)  // voir subscribe(), on ne peut pas retirer par cb
          _socket.removeAllListeners(item)
        }
      })
    }
  } catch(err) {
    console.error("Erreur unsubscribe : %O", err)
  }
}

export function isFormatteurReady() {
  if(_formatteurMessage) {
    const ready = _formatteurMessage.ready()
    return ready
  }
  return false
}

export function clearFormatteurMessage() {
  _formatteurMessage = null
  if(_callbackFormatteurMessage) _callbackFormatteurMessage(false)
}

export async function getCertificatsMaitredescles() {
  // console.debug("getCertificatsMaitredescles local ", _certificatsMaitreDesCles)
  if(_certificatsMaitreDesCles) return _certificatsMaitreDesCles
  const reponse = await emitBlocking('getCertificatsMaitredescles', null, {kind: MESSAGE_KINDS.KIND_REQUETE, noformat: true, ajouterCertificat: true})
  const certificats = []
  // console.debug("getCertificatsMaitredescles Reponse : ", reponse)
  if(!reponse.err) {
    // Valider les certificats recus
    for await (const certificat of reponse) {
      try {
        const forgeCert = await verifierCertificat(certificat)

        // console.debug("Resultat validation : %s", forgeCert!==null)
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

    // Cacher la reponse
    // console.debug("Cert maitre des cles mis en cache : %O", certificats)
    _certificatsMaitreDesCles = certificats
    //_timeoutCertificatsMaitreDesCles = 
    setTimeout(()=>{
      _certificatsMaitreDesCles = null
      //_timeoutCertificatsMaitreDesCles = null
    }, 300000)  // Clear apres 5 minutes
  }
  return certificats.length>0?certificats:null
}

export function genererChallengeWebAuthn(params) {
  // console.debug("Emit genererChallengeWebAuthn : %O", params)
  return emitBlocking('genererChallengeWebAuthn', params, {noformat: true})
}

export function upgradeProteger(data) {
  console.warn("Deprecated : connexionClient.upgradeProteger(), utiliser connexionClient.authentifier()")
  return authentifier(data)
}

export async function authentifier(data, opts) {
  opts = opts || {}

  // console.debug("reactjs.connexionClient.Authentifier data %O, opts %O", data, opts)

  const noCallback = opts.noCallback === true

  if(data) {
      const reponse = await emitBlocking('upgrade', data, {noformat: true})
      if(reponse.nomUsager && _callbackSetUsager) _callbackSetUsager(reponse.nomUsager)
      return reponse
  } else {
      // Faire une requete pour upgrader avec le certificat
      const reponse = await emitBlocking('genererChallengeCertificat', null, {kind: MESSAGE_KINDS.KIND_REQUETE})
      // console.debug("reactjs.connexionClient.Authentifier Challenge : ", reponse)

      // Repondre pour creer l'upgrade
      const data = {...reponse.challengeCertificat}
      // console.debug("reactjs.connexionClient.Authentifier Upgrade : ", data)
      const reponseUpgrade = await emitBlocking('upgrade', data, {kind: MESSAGE_KINDS.KIND_COMMANDE, domaine: 'login', action: 'login', attacherCertificat: true})
      // console.debug("reactjs.connexionClient.Authentifier Reponse upgrade ", reponseUpgrade)
      if(!noCallback && reponseUpgrade.nomUsager && _callbackSetUsager) _callbackSetUsager(reponseUpgrade.nomUsager)
      
      return reponseUpgrade
  }
}
