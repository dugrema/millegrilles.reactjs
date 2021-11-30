import {io as openSocket} from 'socket.io-client'
import axios from 'axios'
import path from 'path'

import { formatteurMessage, forgecommon  } from '@dugrema/millegrilles.utiljs'

const { FormatteurMessageSubtle } = formatteurMessage
const { extraireExtensionsMillegrille } = forgecommon

var _socket = null,
    _clePriveeSubtleDecrypt = null,
    _clePriveeSubtleSign = null,
    _formatteurMessage = null

export async function getInformationMillegrille(opts) {
  const url = path.join('/millegrilles', 'info.json')

  var response = null
  try {
    response = await axios({
      url,
      method: 'get',
      timeout: 3000
    })
  } catch(err) {
    if(err.isAxiosError) {
      // console.error("Erreur axios : %O", err)
      // Extraire information pour passer via message serialise
      // throw ne serialise pas le contenu de l'erreur (e.g. response code)
      const response = err.response
      const errInfo = {
        statusCode: response.status,
        statusText: response.statusText,
        data: response.data,
        isAxiosError: true,
      }
      return({err: errInfo})
    }
    // Erreur generique
    throw err
  }

  // console.debug(response)
  const infoMillegrille = {...response.data, headers: response.headers}

  return infoMillegrille
}

export function getCertificatFormatteur() {
  return {
    // certificat: _formatteurMessage.cert,
    extensions: extraireExtensionsMillegrille(_formatteurMessage.cert)
  }
}

export async function connecter(url, opts) {
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
      reconnectionAttempts: 30,
      reconnectionDelay: 500,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      transports,
    })

    // _socket.on('challengeAuthCertificatNavigateur', (authRequest, cb) => {
    //   cb({err: 'nanana'})
    // })

    const infoIdmg = await emitBlocking('getInfoIdmg', {}, {noformat: true})
    return infoIdmg

  } else {
    const err = new Error("_socket deja charge")
    err.socketOk = true
    throw err
  }
}

export async function initialiserFormatteurMessage(opts) {
  opts = opts || {}
  const clePriveePem = opts.clePriveePem,
        certificatPem = opts.certificatPem,
        DEBUG = opts.DEBUG

  if(clePriveePem) {
    if(DEBUG) console.debug("Charger cle privee PEM (en parametres)")
    // Note : on ne peut pas combiner les usages decrypt et sign
    _clePriveeSubtleDecrypt = await importerClePriveeSubtle(clePriveePem, {usage: ['decrypt']})
    _clePriveeSubtleSign = await importerClePriveeSubtle(clePriveePem, {
      usage: ['sign'], algorithm: 'RSA-PSS', hash: 'SHA-512'})
  } else if(opts.clePriveeDecrypt && opts.clePriveeSign) {
    if(DEBUG) console.debug("Chargement cle privee Subtle")
    _clePriveeSubtleDecrypt = opts.clePriveeDecrypt
    _clePriveeSubtleSign = opts.clePriveeSign
  } else {
    if(DEBUG) console.debug("Charger cle privee a partir de IndexedDB")
    throw new Error("TODO : Importer cle privee a partir de IndexedDB")
  }

  if(certificatPem) {
    if(DEBUG) console.debug("Utiliser chaine pem fournie : %O", certificatPem)
  } else {
    if(DEBUG) console.debug("Charger certificat a partir de IndexedDB")
    throw new Error("TODO : Charger certificat a partir de IndexedDB")
  }

  if(DEBUG) console.debug("Cle privee subtle chargee")
  _formatteurMessage = new FormatteurMessageSubtle(certificatPem, _clePriveeSubtleSign)
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
    }, 7500)

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
