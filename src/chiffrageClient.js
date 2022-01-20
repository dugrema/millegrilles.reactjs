import { pki as forgePki, ed25519 } from '@dugrema/node-forge'

import { 
  hacherCertificat,
  forgecommon, formatteurMessage as formatteurMessageLib,
  // importerClePubliqueSubtle, importerClePriveeSubtle,
  // chiffrerDocument as _chiffrerDocument, 
  // dechiffrerDocument as _dechiffrerDocument,
  // preparerCleSecreteSubtle as _preparerCleSecreteSubtle,
  // dechiffrerSubtle
} from '@dugrema/millegrilles.utiljs'
// import {chiffrerCleSecreteSubtle, dechiffrerCleSecreteSubtle} from '@dugrema/millegrilles.utiljs/src/chiffrage'

const { CertificateStore, validerChaineCertificats, extraireExtensionsMillegrille } = forgecommon
const { FormatteurMessageEd25519, SignateurMessageEd25519 } = formatteurMessageLib

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
  console.debug("!!!2 formatteur message setup, PEM: %O, clePrivee: %O", certificatPem, clePrivee)
  formatteurMessage = new FormatteurMessageEd25519(certificatPem, clePrivee)
  await formatteurMessage.ready  // Permet de recevoir erreur si applicable
  console.debug("!!!3 formatteur message setup complete : %O", formatteurMessage)
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

  const infoCertificat = await validerChaineCertificats(
    certificatPem,
    {...opts, clientStore: certificateStore}
  )

  // if( ! certificateStore.verifierChaine(certificatPem) ) {
  //   throw new Error("Certificat de chiffrage invalide")
  // }
  //
  if(DEBUG) console.debug("Certificat forge : %O", infoCertificat)
  const certificatForge = await infoCertificat.cert
  const extensions = extraireExtensionsMillegrille(certificatForge)
  if(DEBUG) console.debug("Extensions MilleGrille du certificat : %O", extensions)

  if( ! extensions.roles.includes('maitrecles') ) {
    throw new Error("Le certificat de chiffrage n'est pas pour le maitre des cles")
  }
  if( ! extensions.niveauxSecurite.includes('4.secure') && ! extensions.niveauxSecurite.includes('3.protege') ) {
    throw new Error("Le certificat de chiffrage n'est pas de niveau 3.protege ou 4.secure")
  }

  const fingerprint = await hacherCertificat(certificatForge)

  const resultat = {fingerprint}
  if(DEBUG) console.debug("Resultat _validerCertificatChiffrage : %O", resultat)

  return resultat
}

export async function chiffrerDocument(doc, domaine, certificatChiffragePem, identificateurs_document, opts) {
    opts = opts || {}
    const DEBUG = opts.DEBUG

  // Valider le certificat - lance une exception si invalide
  const infoCertificatChiffrage = _validerCertificatChiffrage(certificatChiffragePem)

  // Combiner le certificat fourni avec celui de la millegrille
  const certificatsPem = [certificatChiffragePem, certificatMillegrille.pem]

  throw new Error("fix me")
  // const resultat = await _chiffrerDocument(doc, domaine, certificatsPem, identificateurs_document, opts)

  // // Signer la commande de maitre des cles
  // const commandeMaitrecles = await formatterMessage(resultat.commandeMaitrecles, 'MaitreDesCles.sauvegarderCle', {DEBUG})
  // resultat.commandeMaitrecles = commandeMaitrecles

  // return resultat
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

export async function preparerCleSecreteSubtle(cleSecreteChiffree, iv) {
  return _preparerCleSecreteSubtle(cleSecreteChiffree, iv, clePriveeSubtleDecrypt)
}

export function dechiffrerCleSecrete(cleSecreteChiffree) {
  return dechiffrerCleSecrete(clePrivee, cleSecreteChiffree)
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
