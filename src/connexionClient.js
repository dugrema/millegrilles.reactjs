import {io as openSocket} from 'socket.io-client'
import { pki } from '@dugrema/node-forge'
import { FormatteurMessageEd25519 } from '@dugrema/millegrilles.utiljs/src/formatteurMessage'
import { CertificateStore, extraireExtensionsMillegrille } from '@dugrema/millegrilles.utiljs/src/forgecommon.js'

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

// Re-exporter fonctions de chiffrageClient
export { formatterMessage, chargerCleMillegrille, signerMessageCleMillegrille, clearCleMillegrille } 

const { hacherCertificat: _hacherCertificat } = hachage

let _socket = null,
    _formatteurMessage = null,
    _connecteUneFois = false,
    _connexionCourante = null

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
  // const DEBUG = opts.DEBUG
  // if(DEBUG) console.debug("Initialisation du CertificateStore avec %O", caCert)
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
    _callbackSetEtatConnexion(_connecte)
    onConnect().catch(err=>console.error("connexionClient.onConnect ERROR %O", err))
  })
  socketOn('disconnect', () => {
    if(opts.DEBUG) console.debug("Disconnect socket.io")
    _connecte = false
    if(_callbackSetEtatConnexion) _callbackSetEtatConnexion(false)
    if(_callbackSetUsager) _callbackSetUsager('')
  })
  socketOn('connect_error', err => {
    if(opts.DEBUG) console.debug("Erreur socket.io : %O", err)
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

async function onConnect(infoPromise) {

  // Pour la premiere connexion, infoPromise est le resultat d'une requete getInfoIdmg.
  let info = null
  if(!_connecteUneFois && infoPromise) {
    _connecteUneFois = true
    info = await infoPromise
  } else {
    // Connexion subsequente, il faut faire une requete emitBlocking pour info session
    info = await emitBlocking('getInfoIdmg', {}, {noformat: true})
  }

  // console.debug("connexionClient.onConnect %O", info)
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
  const transports = opts.transports || ['polling', 'websocket']

  if( _socket ) {
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
  _socket = openSocket(hostname, {
    path: pathSocketio,
    reconnection: true,
    reconnectionDelay: 7500,
    transports,
  })

  try {
    return await emitBlocking('getInfoIdmg', {}, {noformat: true})
  } catch(err) {
    return {ok: false, err: 'getInfoIdmg: '+err}
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
  if(_socket != null) {
    _socket.disconnect().catch(err=>console.warning("deconnecter Erreur : %O", err))
    _socket = null
  } else {
    console.warn("_socket n'est pas initialise, on ne peut pas deconnecter")
  }
  _formatteurMessage = null
  if(_callbackFormatteurMessage) _callbackFormatteurMessage(false)
}

export async function verifierMessage(message) {
  return x509VerifierMessage(message)
}

export async function emitBlocking(event, message, opts) {
  /* Emet un message et attend la reponse. */
  opts = opts || {}
  const timeoutDelay = opts.timeout || 9000

  if(!event) throw new TypeError('connexionClient.emitBlocking event null')
  // if(!message) throw new TypeError('connexionClient.emitBlocking message null')

  if( message && !message['_signature'] && opts.noformat !== true ) {
    // Signer le message
    var domaine = opts.domaine
    if(!domaine && message['en-tete']) domaine = message['en-tete'].domaine
    if(domaine) {
      if(!_formatteurMessage) throw new Error("connexionClient.emitBlocking Formatteur de message non initialise")
      message = await _formatteurMessage.formatterMessage(message, domaine, opts)
    }
  }

  return new Promise( (resolve, reject) => {

    // Creer timeout pour echec de commande
    const timeout = setTimeout(_=>{
      reject(new Error('emitBlocking ' + event + ': Timeout socket.io'))
    }, timeoutDelay)

    const traiterReponse = reponse => {
      clearTimeout(timeout)  // Reponse recue, annuler le timeout

      if(reponse && reponse.err) return reject(reponse.err)  // Erreur cote serveur

      if(reponse['_signature'] && reponse['_certificat']) {
        x509VerifierMessage(reponse)
          .then(resultat=>{
            // console.debug("Resultat validation : %O", resultat)
            if(resultat === true) resolve(reponse)
            reject("Reponse invalide (hachage/signature incorrect)")
          })
          .catch(err=>reject(err))
      } else {
        //console.warn("Reponse recue sans signature/cert : ", reponse)
        resolve(reponse)
      }
    }

    if(message) {
      _socket.emit(event, message, traiterReponse)
    } else {
      _socket.emit(event, traiterReponse)
    }

  })
}

export async function emit(event, message, opts) {
  /* Emet un message sans attente (fire and forget) */
  opts = opts || {}

  if( message && !message['_signature'] && opts.noformat !== true ) {
    // Signer le message
    // try {
      var domaine = opts.domaine || message['en-tete'].domaine
      message = await _formatteurMessage.formatterMessage(message, domaine, opts)
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
  const resultat = await emitBlocking(nomEventSocketio, params, opts)
  // console.debug("Resultat subscribe %s : %O", nomEventSocketio, resultat)
  if(resultat && resultat.ok === true) {
    resultat.routingKeys.forEach(item=>{
      // console.debug("subscribe %s Ajouter socketOn %s", nomEventSocketio, item)
      // socketOn(item, cb)  // Note : pas sur pourquoi ca ne fonctionne pas (recoit erreur value)
      socketOn(item, message => cb(message))
    })
  } else {
    const err = new Error("Erreur subscribe %s", nomEventSocketio)
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
    socketOff(nomEventSocketio)
    const resultat = await emitBlocking(nomEventSocketio, params, opts)
    if(resultat && resultat.ok === true) {
      resultat.routingKeys.forEach(item=>{
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
  const reponse = await emitBlocking('getCertificatsMaitredescles', null, {noformat: true, ajouterCertificat: true})
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

export function authentifier(data) {
  if(data) {
    return emitBlocking('upgrade', data, {noformat: true})
      .then(reponse=>{
        if(reponse.nomUsager && _callbackSetUsager) _callbackSetUsager(reponse.nomUsager)
        return reponse
      })
  } else {
    // Faire une requete pour upgrader avec le certificat
    return emitBlocking('genererChallengeCertificat', null).then( reponse => {
      // Repondre pour creer l'upgrade
      const data = {...reponse.challengeCertificat}
      return emitBlocking('upgrade', data, {domaine: 'login', action: 'login', attacherCertificat: true})
    })
    .then(reponse=>{
      if(reponse.nomUsager && _callbackSetUsager) _callbackSetUsager(reponse.nomUsager)
      return reponse
    })
  }
}
