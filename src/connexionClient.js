import {io as openSocket} from 'socket.io-client'
import multibase from 'multibase'
import { getRandom } from '@dugrema/millegrilles.utiljs/src/random'
import { FormatteurMessageEd25519 } from '@dugrema/millegrilles.utiljs/src/formatteurMessage'
import { extraireExtensionsMillegrille } from '@dugrema/millegrilles.utiljs/src/forgecommon.js'

import hachage from './hachage'  // Wiring hachage pour utiljs
import './chiffrage'

import { 
  initialiserFormatteurMessage as initialiserFormatteurMessageChiffrage,
  formatterMessage, chargerCleMillegrille, signerMessageCleMillegrille, clearCleMillegrille,
} from './chiffrageClient'

// Re-exporter fonctions de chiffrageClient
export { formatterMessage, chargerCleMillegrille, signerMessageCleMillegrille, clearCleMillegrille } 

var _socket = null,
    _formatteurMessage = null

var _callbackSetEtatConnexion,
    _callbackSetUsager,
    _x509Worker,
    _urlCourant = '',
    _connecte = false,
    _certificatsMaitreDesCles = ''

export function setX509Worker(x509Worker) {
  _x509Worker = x509Worker
}
    
export function setCallbacks(setEtatConnexion, callbackSetUsager) {
  _callbackSetEtatConnexion = setEtatConnexion
  _callbackSetUsager = callbackSetUsager
}

export function estActif() {
  return _urlCourant && _connecte
}

export async function connecter(urlApp, opts) {
  opts = opts || {}

  if(urlApp === _urlCourant) return

  const urlSocketio = new URL(urlApp)
  // urlSocketio.pathname = path.join(urlSocketio.pathname, 'socket.io')
  if(opts.DEBUG) console.debug("Socket.IO connecter avec url %s", urlSocketio.href)

  const connexion = connecterSocketio(urlSocketio.href, opts)

  socketOn('connect', () => {
    if(opts.DEBUG) console.debug("socket.io connecte a %O", urlSocketio)
    _connecte = true
    _urlCourant = urlApp
    onConnect()
      .then(()=>{
        if(_callbackSetEtatConnexion) _callbackSetEtatConnexion(_connecte)
      })
      .catch(err=>console.error("Erreur connexion : %O", err))
  })
  socketOn('reconnect', () => {
    if(opts.DEBUG) console.debug("Reconnecte")
    _connecte = true
    onConnect()
      .then(()=>{
        if(_callbackSetEtatConnexion) _callbackSetEtatConnexion(_connecte)
      })
      .catch(err=>console.error("Erreur connexion : %O", err))
  })
  socketOn('disconnect', () => {
    if(opts.DEBUG) console.debug("Disconnect socket.io")
    _connecte = false
    if(_callbackSetEtatConnexion) _callbackSetEtatConnexion(false)
  })
  socketOn('connect_error', err => {
    if(opts.DEBUG) console.debug("Erreur socket.io : %O", err)
    _connecte = false
    if(_callbackSetEtatConnexion) _callbackSetEtatConnexion(false)
  })

  return connexion
}

async function onConnect() {

  // // S'assurer que la connexion est faite avec le bon site
  // // const randomBytes = new Uint8Array(64)
  // const randomBytes = await getRandom(64)
  // const challenge = String.fromCharCode.apply(null, multibase.encode('base64', randomBytes))
  // const reponse = await new Promise(async (resolve, reject)=>{
  //   // console.debug("Emission challenge connexion Socket.io : %O", challenge)
  //   const timeout = setTimeout(_=>{
  //     reject('Timeout')
  //   }, 15000)
  //   const reponse = await emitBlocking('challenge', {challenge, noformat: true})
  //   // console.debug("Reponse challenge connexion Socket.io : %O", reponse)
  //   clearTimeout(timeout)

  //   if(reponse.reponse === challenge) {
  //     resolve(reponse)
  //   } else{
  //     reject('Challenge mismatch')
  //   }
  // })

  // // Initialiser les cles, stores, etc pour tous les workers avec
  // // le nom de l'usager. Le certificat doit exister et etre valide pour la
  // // millegrille a laquelle on se connecte.
  // const nomUsager = reponse.nomUsager
  // await _callbackSetUsager(nomUsager)

  // // Valider la reponse signee
  // // const signatureValide = await _verifierSignature(reponse)
  // const signatureValide = await _x509Worker.verifierMessage(reponse)
  // if(!signatureValide) {
  //   throw new Error("Signature de la reponse invalide, serveur non fiable")
  // }

  // // On vient de confirmer que le serveur a un certificat valide qui correspond
  // // a la MilleGrille. L'authentification du client se fait automatiquement
  // // avec le certificat (mode prive ou protege).
  // // Faire l'upgrade protege
  // const resultatProtege = await upgradeProteger()
  // if(resultatProtege) getCertificatsMaitredescles()  // Met en cache le certificat
  // // console.debug("Resultat upgrade protege : %O", resultatProtege)

  // // Emettre l'evenement qui va faire enregistrer les evenements de mise a jour
  // // pour le mapping, siteconfig et sections
  // emit('ecouterMaj')

  // return resultatProtege
}

export function getCertificatFormatteur() {
  return {
    // certificat: _formatteurMessage.cert,
    extensions: extraireExtensionsMillegrille(_formatteurMessage.cert)
  }
}

async function connecterSocketio(url, opts) {
  opts = opts || {}
  const DEBUG = opts.DEBUG

  const transports = opts.transports || ['websocket']

  if( ! _socket ) {

    const urlInfo = new URL(url)
    const hostname = 'https://' + urlInfo.host
    const pathSocketio = urlInfo.pathname

    if(DEBUG) console.debug("Connecter socket.io sur %s (opts: %O)", url, opts)
    _socket = openSocket(hostname, {
      path: pathSocketio,
      reconnection: true,
      reconnectionDelay: 7500,
      // reconnectionAttempts: 30,
      // reconnectionDelayMax: 30000,
      // randomizationFactor: 0.5,
      transports,
    })

    try {
      return await emitBlocking('getInfoIdmg', {}, {noformat: true})
    } catch(err) {
      return {ok: false, err: 'getInfoIdmg: '+err}
    }

  } else {
    const err = new Error("_socket deja charge")
    err.socketOk = true
    throw err
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
}

export function socketOn(eventName, callback) {
  if(!_socket) {
    console.error("socketOn %s, _socket === null", eventName)
    if(callback) callback(false)
    return
  }
  _socket.on(eventName, message => { callback(message) })
}

export function socketOff(eventName, callback) {
  if( ! _socket && callback ) {
    callback(false)
  } else if(callback) {
    _socket.off(eventName, callback)
  } else {
    _socket.removeAllListeners(eventName)
  }
}

export function deconnecter() {
  /* Deconnecte et retire les information de l'usager */
  if(_socket != null) {
    _socket.disconnect()
    _socket = null
  } else {
    console.warn("_socket n'est pas initialise, on ne peut pas deconnecter")
  }
  _formatteurMessage = null
}

export async function emitBlocking(event, message, opts) {
  /* Emet un message et attend la reponse. */
  opts = opts || {}
  const timeoutDelay = opts.timeout || 9000

  if( message && !message['_signature'] && opts.noformat !== true ) {
    // Signer le message
    // try {
      var domaine = opts.domaine || message['en-tete'].domaine
      message = await _formatteurMessage.formatterMessage(message, domaine, opts)
    // } catch(err) {
    //   console.warn("Erreur formattage message : %O", err)
    // }
  }

  return new Promise( (resolve, reject) => {

    // Creer timeout pour echec de commande
    const timeout = setTimeout(_=>{
      reject(new Error('emitBlocking ' + event + ': Timeout socket.io'))
    }, timeoutDelay)

    const traiterReponse = reponse => {
      clearTimeout(timeout)  // Reponse recue, annuler le timeout

      if(reponse && reponse.err) return reject(reponse.err)  // Erreur cote serveur

      resolve(reponse)
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
  console.debug("Resultat subscribe %s : %O", nomEventSocketio, resultat)
  if(resultat && resultat.ok === true) {
    resultat.routingKeys.forEach(item=>{
      console.debug("subscribe %s Ajouter socketOn %s", nomEventSocketio, item)
      socketOn(item, cb)
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
  socketOff(nomEventSocketio)
  const resultat = await emitBlocking(nomEventSocketio, params, opts)
  if(resultat && resultat.ok === true) {
    resultat.routingKeys.forEach(item=>{
      console.debug("unsubscribe %s enregistrerCallbackEvenementsNoeuds socketOff %s", nomEventSocketio, item)
      socketOff(item, cb)
    })
  }
}

// export function getDomainesActions(routingKeys) {
//   // console.debug("Domaines actions, routingKeys : %O", routingKeys)
//   const domainesActions = {}
//   for(let idx in routingKeys) {
//     const rkSplit = routingKeys[idx].split('.')
//     var domaineAction = [rkSplit[0], rkSplit[1], rkSplit[rkSplit.length-1]].join('.')
//     domainesActions[domaineAction] = true
//   }

//   return Object.keys(domainesActions)
// }

export function isFormatteurReady() {
  if(_formatteurMessage) {
    const ready = _formatteurMessage.ready()
    return ready
  }
  return false
}

export function clearFormatteurMessage() {
  _formatteurMessage = null
}

export async function getCertificatsMaitredescles() {
  if(_certificatsMaitreDesCles) return _certificatsMaitreDesCles
  const reponse = await emitBlocking('getCertificatsMaitredescles', null, {noformat: true, ajouterCertificat: true})
  if(!reponse.err) {
    // Cacher la reponse
    // console.debug("Cert maitre des cles mis en cache : %O", reponse)
    _certificatsMaitreDesCles = reponse
  }
  return reponse
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
  } else {
    // Faire une requete pour upgrader avec le certificat
    // console.debug("upgradeProtege, fetch le challenge")
    return emitBlocking('genererChallengeCertificat', null).then( reponse => {
      // console.debug("connexionClient.upgradeProteger Reponse challenge : %O", reponse)
      // Repondre pour creer l'upgrade
      const data = {...reponse.challengeCertificat}
      return emitBlocking('upgrade', data, {action: 'login', attacherCertificat: true})
    })
  }
}

// export function downgradePrive() {

//   // S'assurer d'avoir un seul listener
//   socketOff('challengeAuthU2F')
//   socketOff('challengeRegistrationU2F')

//   return emit('downgradePrive', {}, {noformat: true})
// }

// export async function getCleFichierProtege(fuuid) {
//   return emitBlocking(
//     'getClesFichiers',
//     { liste_hachage_bytes: [fuuid] },
//     { domaine: 'MaitreDesCles', action: 'dechiffrage', attacherCertificat: true }
//   )
// }
