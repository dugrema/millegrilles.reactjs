import { base64 } from 'multiformats/bases/base64'
import { pki as forgePki, ed25519 } from '@dugrema/node-forge'

import { CertificateStore, extraireExtensionsMillegrille } from '@dugrema/millegrilles.utiljs/src/forgecommon'
import { FormatteurMessageEd25519, SignateurMessageEd25519 } from '@dugrema/millegrilles.utiljs/src/formatteurMessage'
import * as hachage from './hachage'
import { chiffrage } from './chiffrage'
import * as ed25519Utils from '@dugrema/millegrilles.utiljs/src/chiffrage.ed25519'

export {chiffrage}

const { hacherCertificat: _hacherCertificat } = hachage

const TAILLE_BUFFER = 1 * 1024 * 1024

var certificateStore = null   // CertificateStore pour valider x.509
var certificatMillegrille = null   // Objet du certificat de la MilleGrille {cert, fingerprint}
var _clePrivee = null
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
    fingerprint: await _hacherCertificat(certificateStore.cert)
  }
}

export function setCallbackCleMillegrille(cb) {
  // console.debug("Initialisation du callback pour cle de MilleGrille")
  _callbackCleMillegrille = cb
}

export async function initialiserFormatteurMessage(certificatPem, clePrivee, opts) {
  opts = opts || {}
  _clePrivee = ed25519.privateKeyFromPem(clePrivee)
  formatteurMessage = new FormatteurMessageEd25519(certificatPem, clePrivee)
  await formatteurMessage.ready  // Permet de recevoir erreur si applicable
}

export async function getFingerprintSignature() {
  await formatteurMessage.ready  // Permet de recevoir erreur si applicable
  return formatterMessage.fingerprint
}

export function clearInfoSecrete() {
  formatteurMessage = null
  _cleMillegrille = null
  _clePrivee = null
  console.info("Information secrete retiree de la memoire")
}

export function verifierCertificat(certificat, opts) {
  /* Expose verifierChaine du certificate store */
  if(typeof(certificat) === 'string') {
    certificat = forgePki.certificateFromPem(certificat)
  }
  
  const resultat = certificateStore.verifierChaine(certificat, opts)
  // console.debug("Resultat verifier chaine : %O", resultat)
  return resultat?true:false
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

  const certificatForge = forgePki.certificateFromPem(certificatPem)
  if(!verifierCertificat(certificatPem, opts)) {
    throw new Error("chiffrageClient._validerCertificatChiffrage Certificat forge invalide : %O", certificatForge)
  }

  if(DEBUG) console.debug("Certificat forge : %O", certificatForge)
  // const certificatForge = await infoCertificat.cert
  const extensions = extraireExtensionsMillegrille(certificatForge)
  if(DEBUG) console.debug("Extensions MilleGrille du certificat : %O", extensions)

  const certCN = certificatForge.subject.getField('CN').value
  if(certCN.toLowerCase() === 'millegrille') { 
    // Ok
  } else {
    if( ! extensions.roles.includes('maitredescles') ) {
      throw new Error("Le certificat de chiffrage n'est pas pour le maitre des cles")
    }
    if( ! extensions.niveauxSecurite.includes('4.secure') ) {
      throw new Error("Le certificat de chiffrage n'est pas de niveau 4.secure")
    }
  }

  const fingerprint = await _hacherCertificat(certificatForge)

  const resultat = {fingerprint}
  if(DEBUG) console.debug("Resultat _validerCertificatChiffrage : %O", resultat)

  return resultat
}

export async function chiffrerDocument(doc, domaine, certificatsChiffragePem, opts) {
    opts = opts || {}
    const { DEBUG, identificateurs_document } = opts
    // console.debug("chiffrerDocument doc %O, identificateurs_document %O", doc, identificateurs_document)
    // console.debug("Certificat millegrille : %O", certificatMillegrille)

    // Valider les certificats de maitre des cles
    // Conserver uniquement le premier certificat dans chaque instance de PEMs
    const certificatsListeChiffrage = []
    for await (const pems of certificatsChiffragePem) {
      try {
        // Valider le certificat - lance une Erreur si invalide
        await _validerCertificatChiffrage(pems, opts)
        const certificatForge = forgePki.certificateFromPem(pems[0])
        const extensions = extraireExtensionsMillegrille(certificatForge)
        const roles = extensions.roles || []
        if(roles.includes('maitredescles')) {
          certificatsListeChiffrage.push(pems[0])
        } else {
          console.warn("Certificat maitre des cles invalide - role maitredescles manquant")
        }
      } catch(err) {
        console.warn("Certificat maitre des cles invalide ", err)
      }
    }

    const resultat = await chiffrage.chiffrerDocument(
      doc, domaine, certificatMillegrille.pem, identificateurs_document, 
      {...opts, certificats: certificatsListeChiffrage}
    )
    // console.debug("resultat chiffrage : %O", resultat)

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
  // console.debug("Charger cle millegrille : %O", clePrivee)
  if( ! _cleMillegrille ) {
    // _cleMillegrille = clePrivee

    if(typeof(clePrivee) === 'string') {
      // Probablement format PEM
      _cleMillegrille = ed25519.privateKeyFromPem(clePrivee)
      _cleMillegrille.pem = clePrivee
    } else {
      throw new Error("Format de cle privee inconnu")
    }
  
  }

  if(_callbackCleMillegrille) _callbackCleMillegrille(true)
}

export async function clearCleMillegrille() {
  _cleMillegrille = null
  try {
    _callbackCleMillegrille(false)
  } catch(err) {
    // OK
  }
}

export async function rechiffrerAvecCleMillegrille(
  connexion, pemRechiffrage, setNombreClesRechiffrees, setNombreErreurs, opts) {
  /*
    secretsChiffres : correlation = buffer
    pemRechiffrage : certificat a utiliser pour rechiffrer
  */
  opts = opts || {}
  const DEBUG = opts.DEBUG || false,
        batchSize = opts.batchSize || 100

  if(!_cleMillegrille) {
    throw new Error("Cle de MilleGrille non chargee")
  }

  const certificat = forgePki.certificateFromPem(pemRechiffrage),
        publicKey = certificat.publicKey.publicKeyBytes,
        fingerprintMaitredescles = await _hacherCertificat(certificat)

  if(DEBUG) console.debug("Rechiffrer cles avec cert %O", certificat)

  let nombreClesRechiffrees = 0,
      nombreErreurs = 0,
      plusRecenteCle = 0,
      excludeHachageBytes = null

  let dernierePromise = null

  while(true) {
    const clesNonDechiffrables = await connexion.requeteClesNonDechiffrables(batchSize, plusRecenteCle, excludeHachageBytes)

    const {date_creation_max, cles} = clesNonDechiffrables
    if(!cles || cles.length == 0) break

    if(clesNonDechiffrables.date_creation_max) {
      if(plusRecenteCle === date_creation_max) {
        console.warn("2 batch rechiffrage avec meme date max, on incremente pour sortir d'une boucle infinie")
        plusRecenteCle = date_creation_max + 1
      } else {
        plusRecenteCle = date_creation_max
      }
    }
    if(DEBUG) console.debug("Cles non dechiffrables : %O", clesNonDechiffrables)
    excludeHachageBytes = cles.map(item=>item.hachage_bytes)

    try {
      //const debutRechiffrage = new Date().getTime()
      const clesRechiffrees = await Promise.all(cles.map(cle=>{
        return ed25519Utils.dechiffrerCle(cle.cle, _cleMillegrille)
          .then(async cleDechiffree=>{
            if(DEBUG) console.debug("Cle dechiffree : %O", cleDechiffree)
            if(Array.isArray(cleDechiffree)) {
              // Convertir en uint8array
              const cleDechiffreeUintArray = new Uint16Array(32)
              cleDechiffreeUintArray.set(cleDechiffree)
              cleDechiffree = cleDechiffreeUintArray
            }

            const cleRechiffree = await ed25519Utils.chiffrerCle(cleDechiffree, publicKey)

            const cleComplete = {
              ...cle, 
              cle: cleRechiffree,
            }

            return cleComplete
          })
          .catch(err=>{
            console.error("Erreur dechiffrage cle : %O", err)
            nombreErreurs++
            return {ok: false, err: err}
          })
      }))
      // const finRechiffrage = new Date().getTime()
      // const dureeRechiffrage = finRechiffrage - debutRechiffrage
      // console.debug("Duree rechiffrage cles : %d ms", dureeRechiffrage)
      if(DEBUG) console.debug("Cles rechiffrees : %O", clesRechiffrees)

      const clesPretes = clesRechiffrees.filter(cle=>cle.ok!==false)
      const commande = { cles: clesPretes }
      dernierePromise = connexion.rechiffrerClesBatch(commande, fingerprintMaitredescles)
        .then(reponse=>{
          if(DEBUG) console.debug("Reponse rechiffrerClesBatch : %O", reponse)
          nombreClesRechiffrees += cles.length
        })
        .catch(err=>{
          console.error("Erreur traitement batch : %O", err)
        })
        .finally(()=>{
          setNombreClesRechiffrees(nombreClesRechiffrees)
          setNombreErreurs(nombreErreurs)
        })

    } catch(err) {
      console.error("Erreur rechiffrage batch cles : %O", err)
      return
    }

  }

  return dernierePromise
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
  const partition = await _hacherCertificat(certificat)
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

export function dechiffrerCleSecrete(cleSecreteChiffree) {
  return ed25519Utils.dechiffrerCle(cleSecreteChiffree, _clePrivee)
}

export function hacherCertificat(pem) {
  if(Array.isArray(pem)) pem = pem[0]
  const certificat = forgePki.certificateFromPem(pem)
  return _hacherCertificat(certificat)
}
