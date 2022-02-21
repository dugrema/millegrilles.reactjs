import { base64 } from 'multiformats/bases/base64'
import { pki as forgePki, ed25519 } from '@dugrema/node-forge'

// import { 
//   hacherCertificat,
//   forgecommon, formatteurMessage as formatteurMessageLib,
//   // importerClePubliqueSubtle, importerClePriveeSubtle,
//   // chiffrerDocument as _chiffrerDocument, 
//   // dechiffrerDocument as _dechiffrerDocument,
//   // preparerCleSecreteSubtle as _preparerCleSecreteSubtle,
//   // dechiffrerSubtle
// } from '@dugrema/millegrilles.utiljs/src/index'
// import {chiffrerCleSecreteSubtle, dechiffrerCleSecreteSubtle} from '@dugrema/millegrilles.utiljs/src/chiffrage'

// import { setHacheurs, hacherCertificat } from '@dugrema/millegrilles.utiljs/src/hachage'
import { CertificateStore, validerChaineCertificats, extraireExtensionsMillegrille } from '@dugrema/millegrilles.utiljs/src/forgecommon'
import { FormatteurMessageEd25519, SignateurMessageEd25519 } from '@dugrema/millegrilles.utiljs/src/formatteurMessage'
import hachage from './hachage'
import * as chiffrage from './chiffrage'
import * as ed25519Utils from '@dugrema/millegrilles.utiljs/src/chiffrage.ed25519'

export {chiffrage}

const { hacherCertificat } = hachage

// Set hachage
// console.debug("Hachage chiffrageClient : %O", hacheurs)
//setHacheurs(hacheurs)


// const { CertificateStore, validerChaineCertificats, extraireExtensionsMillegrille } = forgecommon
// const { FormatteurMessageEd25519, SignateurMessageEd25519 } = formatteurMessageLib

// import { 
//   forgecommon, formatteurMessage as formatteurMessageLib, hachage, 

//   chiffrerCleSecreteSubtle, dechiffrerCleSecreteSubtle,
//   importerClePubliqueSubtle, importerClePriveeSubtle,
//   chiffrerDocument as _chiffrerDocument, dechiffrerDocument as _dechiffrerDocument,
//   preparerCleSecreteSubtle as _preparerCleSecreteSubtle,
//   dechiffrerSubtle,

// } from '@dugrema/millegrilles.utiljs'

// const { CertificateStore, validerChaineCertificats, extraireExtensionsMillegrille } = forgecommon
// const { FormatteurMessageSubtle, SignateurMessageSubtle } = formatteurMessageLib
// const { hacherCertificat } = hachage
// const {
//   chiffrerCleSecreteSubtle, dechiffrerCleSecreteSubtle,
//   importerClePubliqueSubtle, importerClePriveeSubtle,
//   chiffrerDocument: _chiffrerDocument, dechiffrerDocument: _dechiffrerDocument,
//   preparerCleSecreteSubtle: _preparerCleSecreteSubtle,
// } = chiffrage

const TAILLE_BUFFER = 1 * 1024 * 1024

var certificateStore = null   // CertificateStore pour valider x.509
var certificatMillegrille = null   // Objet du certificat de la MilleGrille {cert, fingerprint}
var _clePrivee = null
// var clePriveeSubtleDecrypt = null  // Cle privee format subtle, pour dechiffrage
// var clePriveeSubtleSign = null     // Cle privee format subtle, pour signature
var formatteurMessage = null  // Formatteur de message avec signature

// Conserver cle de millegrille format subtle
// dict - cle = 'sign', 'decrypt'
var _cleMillegrille = null
var _callbackCleMillegrille = null  // Callback sur etat de la cle de millegrille

export async function initialiserCertificateStore(caCert, opts) {
  const DEBUG = opts.DEBUG
  if(DEBUG) console.debug("Initialisation du CertificateStore avec %O, opts=%O", caCert, opts)
  certificateStore = new CertificateStore(caCert, opts)
  if(DEBUG) console.debug("CertificateStore initialise %O", certificateStore)

  certificatMillegrille = {
    pem: caCert,
    cert: certificateStore.cert,
    fingerprint: await hacherCertificat(certificateStore.cert)
  }
}

export function initialiserCallbackCleMillegrille(cb) {
  // console.debug("Initialisation du callback pour cle de MilleGrille")
  _callbackCleMillegrille = cb
}

export async function initialiserFormatteurMessage(certificatPem, clePrivee, opts) {
  opts = opts || {}
  _clePrivee = ed25519.privateKeyFromPem(clePrivee)
  formatteurMessage = new FormatteurMessageEd25519(certificatPem, clePrivee)
  await formatteurMessage.ready  // Permet de recevoir erreur si applicable
}

export function clearInfoSecrete() {
  formatteurMessage = null
  _cleMillegrille = null
  _clePrivee = null
  console.info("Information secrete retiree de la memoire")
}

export function verifierCertificat(certificat, opts) {
  /* Expose verifierChaine du certificate store */
  if(typeof(chainePEM) === 'string') {
    certificat = forgePki.certificateFromPem(certificat)
  }
  return certificateStore.verifierChaine(certificat, opts)
}

export function formatterMessage(message, domaineAction, opts) {
  opts = opts || {}
  opts.attacherCertificat = true  // Toujours attacher le certificat

  /* Expose formatterMessage du formatteur de messages */
  if(opts.DEBUG) console.debug("Formatter domaine=%s, message : %O", domaineAction, message)

  return formatteurMessage.formatterMessage(message, domaineAction, opts)
}

export function signerMessageCleMillegrille(message, opts) {
  opts = opts || {}

  /* Expose formatterMessage du formatteur de messages */
  //if(opts.DEBUG) 
  console.debug("Signer message avec cle de MilleGrille: %O (cle: %O)", message, _cleMillegrille)
  const signateur = new SignateurMessageEd25519(_cleMillegrille)
  return signateur.signer(message)
}

export async function _validerCertificatChiffrage(certificatPem, opts) {
  /* Valide le certificat pour chiffrage et retourne la cle publique.
     Le certificat doit avoir le role 'maitrecles'. */
  opts = opts || {}
  const DEBUG = opts.DEBUG

  if(!certificateStore) throw new Error("CertificatStore non initialise pour verifier certificat de chiffrage")

  const certificatForge = verifierCertificat(certificatPem, opts)

  // const infoCertificat = await validerChaineCertificats(
  //   certificatPem,
  //   {...opts, clientStore: certificateStore}
  // )

  // if( ! certificateStore.verifierChaine(certificatPem) ) {
  //   throw new Error("Certificat de chiffrage invalide")
  // }
  //
  if(DEBUG) console.debug("Certificat forge : %O", infoCertificat)
  // const certificatForge = await infoCertificat.cert
  const extensions = extraireExtensionsMillegrille(certificatForge)
  if(DEBUG) console.debug("Extensions MilleGrille du certificat : %O", extensions)

  if( ! extensions.roles.includes('maitrecles') ) {
    throw new Error("Le certificat de chiffrage n'est pas pour le maitre des cles")
  }
  if( ! extensions.niveauxSecurite.includes('4.secure') ) {
    throw new Error("Le certificat de chiffrage n'est pas de niveau 4.secure")
  }

  const fingerprint = await hacherCertificat(certificatForge)

  const resultat = {fingerprint}
  if(DEBUG) console.debug("Resultat _validerCertificatChiffrage : %O", resultat)

  return resultat
}

export async function chiffrerDocument(doc, domaine, certificatChiffragePem, opts) {
    opts = opts || {}
    const { DEBUG, identificateurs_document } = opts

  console.debug("Certificat millegrille : %O", certificatMillegrille)

  // Valider le certificat - lance une exception si invalide
  const infoCertificatChiffrage = await _validerCertificatChiffrage(certificatChiffragePem)
  console.debug("InfoCert chiffrage: %O", infoCertificatChiffrage)

  const certificatsListeChiffrage = [certificatChiffragePem.shift()]

  const resultat = await chiffrage.chiffrerDocument(
    doc, domaine, certificatMillegrille.pem, identificateurs_document, 
    {...opts, certificats: certificatsListeChiffrage}
  )
  console.debug("resultat chiffrage : %O", resultat)

  // // Signer la commande de maitre des cles
  const commandeMaitrecles = await formatterMessage(resultat.commandeMaitrecles, 'MaitreDesCles', {action: 'sauvegarderCle', ajouterCertificat: true, DEBUG})
  resultat.commandeMaitrecles = commandeMaitrecles

  return resultat
}

export function dechiffrerDocument(ciphertext, messageCle, opts) {
  // Wrapper pour dechiffrer document, insere la cle privee locale
  throw new Error("fix me")
  // return _dechiffrerDocument(ciphertext, messageCle, _clePrivee, opts)
}

export async function chargerCleMillegrille(clePrivee) {
  console.debug("Charger cle millegrille : %O", clePrivee)
  // var cleMillegrilleSubtle = null
  if(typeof(clePrivee) === 'string') {
    // Probablement format PEM
    ed25519.privateKeyFromPem(clePrivee)
  } 
  //else if(clePrivee.privateKeyBytes) {
    // Ok, deja format forge
    // clePrivee = forgePki.privateKeyFromPem(clePrivee)
  //} 
  // else if(clePrivee.clePriveeDecrypt && clePrivee.clePriveeSigner) {
  //   // Formats subtle
  //   _cleMillegrille = {
  //     clePriveeDecrypt: clePrivee.clePriveeDecrypt,
  //     clePriveeSign: clePrivee.clePriveeSigner,
  //   }
  // } 
  else {
    throw new Error("Format de cle privee inconnu")
  }

  try {
    // console.debug("Importer cle privee subtle - decrypt")
    if( ! _cleMillegrille ) {
      _cleMillegrille = clePrivee
    }

    try {
      // console.debug("Callback etat")
      _callbackCleMillegrille(true)
    } catch(err) {
      // OK
    }

  } catch(err) {
    console.error("Erreur preparation cle subtle : %O", err)
    throw err
  }

}

export async function clearCleMillegrille() {
  _cleMillegrille = null
  try {
    _callbackCleMillegrille(false)
  } catch(err) {
    // OK
  }
}

export async function rechiffrerAvecCleMillegrille(secretsChiffres, pemRechiffrage, opts) {
  /*
    secretsChiffres : correlation = buffer
    pemRechiffrage : certificat a utiliser pour rechiffrer
  */
  opts = opts || {}
  const DEBUG = opts.DEBUG

  if(!_cleMillegrille || !_cleMillegrille.decrypt) {
    throw new Error("Cle de MilleGrille non chargee")
  }

  // Importer la cle publique en format Subtle a partir du pem de certificat
  const certificat = forgePki.certificateFromPem(pemRechiffrage)
  var clePublique = forgePki.publicKeyToPem(certificat.publicKey)
  const regEx = /\n?\-{5}[A-Z ]+\-{5}\n?/g
  clePublique = clePublique.replaceAll(regEx, '')
  clePublique = await importerClePubliqueSubtle(clePublique)
  if(DEBUG) console.debug("Cle publique extraite du pem : %O", clePublique)

  const promises = Object.keys(secretsChiffres).map(async correlation => {
    var buffer = secretsChiffres[correlation]
    buffer = await dechiffrerCleSecreteSubtle(_cleMillegrille.decrypt, buffer)
    buffer = await chiffrerCleSecreteSubtle(clePublique, buffer)
    if(DEBUG) console.debug("Cle %s rechiffree", correlation)
    return {[correlation]: buffer}
  })

  var resultats = await Promise.all(promises)
  if(DEBUG) console.debug("Resultats rechiffrage : %O", resultats)

  // Concatener toutes les reponses
  const secretsRechiffres = resultats.reduce((secretsRechiffres, item)=>{
    return {...secretsRechiffres, ...item}
  }, {})

  return secretsRechiffres
}

export async function chiffrerSecret(secrets, pemRechiffrage, opts) {
  /*
    secretsChiffres : dict correlation = buffer
    pemRechiffrage : certificat a utiliser pour rechiffrer
  */
  opts = opts || {}
  const DEBUG = opts.DEBUG
  if(DEBUG) console.debug("chiffrer secrets: %O", secrets)

  // Importer la cle publique en format Subtle a partir du pem de certificat
  const certificat = forgePki.certificateFromPem(pemRechiffrage)
  const partition = await hacherCertificat(certificat)
  let clePublique = certificat.publicKey
  if(clePublique.publicKeyBytes) clePublique = clePublique.publicKeyBytes
  // var clePublique = forgePki.publicKeyToPem(certificat.publicKey)
  // const regEx = /\n?\-{5}[A-Z ]+\-{5}\n?/g
  // clePublique = clePublique.replaceAll(regEx, '')
  // clePublique = await importerClePubliqueSubtle(clePublique)
  if(DEBUG) console.debug("Cle publique extraite du pem : %O", clePublique)

  const promises = Object.keys(secrets).map(async correlation => {
    var cleSecrete = secrets[correlation]
    // if(typeof(buffer) === 'string') buffer = base64.decode(buffer)
    // buffer = await chiffrerCleSecreteSubtle(clePublique, buffer)
    if(typeof(cleSecrete) === 'string') cleSecrete = base64.decode(cleSecrete)
    if(DEBUG) console.debug("Chiffrer cle secrete : %O", cleSecrete)
    const cleChiffree = await ed25519Utils.chiffrerCle(cleSecrete, clePublique, {ed25519: true})

    if(DEBUG) console.debug("Cle %s chiffree : %O", correlation, cleChiffree)
    return {[correlation]: cleChiffree}
  })

  var resultats = await Promise.all(promises)
  if(DEBUG) console.debug("Resultats rechiffrage : %O", resultats)

  // Concatener toutes les reponses
  const secretsRechiffres = resultats.reduce((secretsRechiffres, item)=>{
    return {...secretsRechiffres, ...item}
  }, {})

  return {cles: secretsRechiffres, partition}
}

// export async function preparerCleSecreteSubtle(cleSecreteChiffree, iv) {
//   return _preparerCleSecreteSubtle(cleSecreteChiffree, iv, clePriveeSubtleDecrypt)
// }

export function dechiffrerCleSecrete(cleSecreteChiffree) {
  console.debug("Cle secrete chiffree : %O", cleSecreteChiffree)
  return ed25519Utils.dechiffrerCle(cleSecreteChiffree, _clePrivee)
}

// Re-export des imports
//export { dechiffrerSubtle }

// comlinkExpose({
//   initialiserCertificateStore, initialiserFormatteurMessage,
//   initialiserCallbackCleMillegrille,
//   chargerCleMillegrilleSubtle, clearCleMillegrilleSubtle,
//   verifierCertificat, formatterMessage,
//   chiffrerDocument, dechiffrerDocument,
//   rechiffrerAvecCleMillegrille, signerMessageCleMillegrille,
//   clearInfoSecrete, preparerCleSecreteSubtle,
// })

// export {
//   initialiserCertificateStore, initialiserFormatteurMessage,
//   initialiserCallbackCleMillegrille,
//   chargerCleMillegrilleSubtle, clearCleMillegrilleSubtle,
//   verifierCertificat, formatterMessage,
//   chiffrerDocument, dechiffrerDocument,
//   rechiffrerAvecCleMillegrille, signerMessageCleMillegrille,
//   clearInfoSecrete, preparerCleSecreteSubtle,
// }
