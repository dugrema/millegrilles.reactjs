import {io as openSocket} from 'socket.io-client'
import path from 'path'
import multibase from 'multibase'

import { formatteurMessage, forgecommon, getRandomValues } from '@dugrema/millegrilles.utiljs'

const { FormatteurMessageSubtle } = formatteurMessage
const { extraireExtensionsMillegrille } = forgecommon

var _socket = null,
    _formatteurMessage = null

var _callbackSetEtatConnexion,
    _callbackSetUsager,
    _x509Worker,
    _urlCourant = '',
    _connecte = false,
    _protege = false

export function setCallbacks(setEtatConnexion, x509Worker, callbackSetUsager) {
  _callbackSetEtatConnexion = setEtatConnexion
  _x509Worker = x509Worker
  _callbackSetUsager = callbackSetUsager
}

export function estActif() {
  return _urlCourant && _connecte && _protege
}

export async function connecter(urlApp, opts) {
  opts = opts || {}

  if(urlApp === _urlCourant) return

  const urlSocketio = new URL(urlApp)
  urlSocketio.pathname = path.join(urlSocketio.pathname, 'socket.io')
  console.debug("Socket.IO connecter avec url %s", urlSocketio.href)

  const connexion = connecterSocketio(urlSocketio.href, opts)

  socketOn('connect', _=>{
    // console.debug("socket.io connecte a %O", urlSocketio)
    _connecte = true
    _urlCourant = urlApp
    onConnect()
      .then(protege=>{
        _protege = protege
        if(_callbackSetEtatConnexion) _callbackSetEtatConnexion(protege)
      })
  })
  socketOn('reconnect', _=>{
    // console.debug("Reconnecte")
    _connecte = true
    onConnect()
      .then(protege=>{
        _protege = protege
        if(_callbackSetEtatConnexion) _callbackSetEtatConnexion(protege)
      })
  })
  socketOn('disconnect', _=>{
    // console.debug("Disconnect socket.io")
    _connecte = false
    _protege = false
    if(_callbackSetEtatConnexion) _callbackSetEtatConnexion(false)
  })
  socketOn('connect_error', err=>{
    // console.debug("Erreur socket.io : %O", err)
    _connecte = false
    _protege = false
    if(_callbackSetEtatConnexion) _callbackSetEtatConnexion(false)
  })

  return connexion
}

async function onConnect() {

  // S'assurer que la connexion est faite avec le bon site
  const randomBytes = new Uint8Array(64)
  await getRandomValues(randomBytes)
  const challenge = String.fromCharCode.apply(null, multibase.encode('base64', randomBytes))
  const reponse = await new Promise(async (resolve, reject)=>{
    // console.debug("Emission challenge connexion Socket.io : %O", challenge)
    const timeout = setTimeout(_=>{
      reject('Timeout')
    }, 15000)
    const reponse = await emitBlocking('challenge', {challenge, noformat: true})
    // console.debug("Reponse challenge connexion Socket.io : %O", reponse)
    clearTimeout(timeout)

    if(reponse.reponse === challenge) {
      resolve(reponse)
    } else{
      reject('Challenge mismatch')
    }
  })

  // Initialiser les cles, stores, etc pour tous les workers avec
  // le nom de l'usager. Le certificat doit exister et etre valide pour la
  // millegrille a laquelle on se connecte.
  const nomUsager = reponse.nomUsager
  await _callbackSetUsager(nomUsager)

  // Valider la reponse signee
  // const signatureValide = await _verifierSignature(reponse)
  const signatureValide = await _x509Worker.verifierMessage(reponse)
  if(!signatureValide) {
    throw new Error("Signature de la reponse invalide, serveur non fiable")
  }

  // console.debug("Signature du serveur est valide")
  // On vient de confirmer que le serveur a un certificat valide qui correspond
  // a la MilleGrille. L'authentification du client se fait automatiquement
  // avec le certificat (mode prive ou protege).

  // Faire l'upgrade protege
  const resultatProtege = await upgradeProteger()
  // console.debug("Resultat upgrade protege : %O", resultatProtege)

  // Emettre l'evenement qui va faire enregistrer les evenements de mise a jour
  // pour le mapping, siteconfig et sections
  emit('ecouterMaj')

  return resultatProtege
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

    const infoIdmg = await emitBlocking('getInfoIdmg', {}, {noformat: true})
    return infoIdmg

  } else {
    const err = new Error("_socket deja charge")
    err.socketOk = true
    throw err
  }
}

export async function initialiserFormatteurMessage(certificatPem, clePriveeSign, opts) {
  opts = opts || {}
  _formatteurMessage = new FormatteurMessageSubtle(certificatPem, clePriveeSign)
  await _formatteurMessage.ready  // Permet de recevoir erreur si applicable
}

export function socketOn(eventName, callback) {
  _socket.on(eventName, message => { callback(message) })
}

export function socketOff(eventName, callback) {
  if(callback) {
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
  _clePriveeSubtleDecrypt = null
  _clePriveeSubtleSign = null
  _formatteurMessage = null
  console.info("Deconnexion completee")
}

export function subscribe(routingKeys, callback, opts) {
  if(!opts) opts = {}
  const DEBUG = opts.DEBUG

  const niveauxSecurite = opts.exchange || ['1.public']
  if(DEBUG) console.debug("Enregistrer %O sur exchanges %O", routingKeys, niveauxSecurite)

  const callbackFilter = function(message) {
    if(!message) return

    // Filtrer par routing key
    const routingKey = message.routingKey
    if(DEBUG) console.debug("Message recu, routingKey : %s", routingKey)

    if(routingKeys.includes(routingKey) && niveauxSecurite.includes(message.exchange)) {
      try {
        callback(message)
      } catch(err) {
        console.error("Erreur traitement callback sur %s", routingKey)
      }
    }
  }

  // Transmet une liste de routingKeys a enregistrer sur notre Q.
  _socket.emit('subscribe', {routingKeys, exchange: niveauxSecurite})

  const domainesActions = getDomainesActions(routingKeys)
  if(DEBUG) console.debug("Enregistrer listeners domaineAction : %O", domainesActions)
  domainesActions.forEach(domaineAction=>{
    _socket.on(domaineAction, callbackFilter)
  })

  // Retourne une methode pour faire le "unsubscribe"
  // return callbackFilter
}

export function unsubscribe(routingKeys, callback, opts) {
  // Retrait du listener d'evenement
  // console.debug("Unsubscribe callback, socket.off %O", routingKeys)
  _socket.emit('unsubscribe', {routingKeys, opts})

  const domainesAction = getDomainesActions(routingKeys)
  domainesAction.forEach(domaineAction=>{
    _socket.off(domaineAction, callback)
  })

}

export async function emitBlocking(event, message, opts) {
  /* Emet un message et attend la reponse. */
  opts = opts || {}

  if( message && !message['_signature'] && !opts.noformat ) {
    // Signer le message
    try {
      var domaine = opts.domaine || message['en-tete'].domaine
      message = await _formatteurMessage.formatterMessage(message, domaine, opts)
    } catch(err) {
      console.warn("Erreur formattage message : %O", err)
    }
  }

  return new Promise( (resolve, reject) => {

    // Creer timeout pour echec de commande
    const timeout = setTimeout(_=>{
      reject(new Error('emitBlocking ' + event + ': Timeout socket.io'))
    }, 9000)

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

  if( message && !message['_signature'] && !opts.noformat ) {
    // Signer le message
    try {
      var domaine = opts.domaine || message['en-tete'].domaine
      message = await _formatteurMessage.formatterMessage(message, domaine, opts)
    } catch(err) {
      console.warn("Erreur formattage message : %O", err)
    }
  }

  if(message) {
    _socket.emit(event, message)
  } else {
    _socket.emit(event)
  }
}

export function getDomainesActions(routingKeys) {
  // console.debug("Domaines actions, routingKeys : %O", routingKeys)
  const domainesActions = {}
  for(let idx in routingKeys) {
    const rkSplit = routingKeys[idx].split('.')
    var domaineAction = [rkSplit[0], rkSplit[1], rkSplit[rkSplit.length-1]].join('.')
    domainesActions[domaineAction] = true
  }

  return Object.keys(domainesActions)
}

export function isFormatteurReady() {
  if(_formatteurMessage) {
    const ready = _formatteurMessage.ready()
    return ready
  }
  return false
}

export function getCertificatsMaitredescles() {
  return emitBlocking('getCertificatsMaitredescles', null, {noformat: true})
}

export function genererChallengeWebAuthn(params) {
  console.debug("Emit genererChallengeWebAuthn : %O", params)
  return emitBlocking('genererChallengeWebAuthn', params, {noformat: true})
}

export function upgradeProteger(data) {
  if(data) {
    return emitBlocking('upgradeProtege', data, {noformat: true})
  } else {
    // Faire une requete pour upgrader avec le certificat
    // console.debug("upgradeProtege, fetch le challenge")
    return emitBlocking('genererChallengeCertificat', null).then( reponse => {
      // console.debug("connexionClient.upgradeProteger Reponse challenge : %O", reponse)
      // Repondre pour creer l'upgrade
      const data = {...reponse.challengeCertificat}
      return emitBlocking('upgradeProtege', data, {domaine: 'login', attacherCertificat: true})
    })
  }
}

export function downgradePrive() {

  // S'assurer d'avoir un seul listener
  socketOff('challengeAuthU2F')
  socketOff('challengeRegistrationU2F')

  return emit('downgradePrive', {}, {noformat: true})
}

// module.exports = {
//   connecter, deconnecter,
//   initialiserFormatteurMessage, isFormatteurReady,
//   subscribe, unsubscribe, emit, emitBlocking,
//   socketOn, socketOff,
//   getInformationMillegrille, getCertificatsMaitredescles,
//   genererChallengeWebAuthn, upgradeProteger, downgradePrive,
//   getCertificatFormatteur,
// }
