import { base64 } from 'multiformats/bases/base64'
import { pki as forgePki, ed25519 } from '@dugrema/node-forge'

import { CertificateStore, extraireExtensionsMillegrille } from '@dugrema/millegrilles.utiljs/src/forgecommon'
import { FormatteurMessageEd25519, SignateurMessageEd25519 } from '@dugrema/millegrilles.utiljs/src/formatteurMessage'
import * as hachage from './hachage'
import { chiffrage } from './chiffrage'
import * as ed25519Utils from '@dugrema/millegrilles.utiljs/src/chiffrage.ed25519'
import { MESSAGE_KINDS } from '@dugrema/millegrilles.utiljs/src/constantes'
import pako from 'pako'
import { SignatureDomaines } from '@dugrema/millegrilles.utiljs/src/maitredescles'

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
  opts = opts || {}
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
  return formatteurMessage.fingerprint
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
  const kind = opts.kind

  /* Expose formatterMessage du formatteur de messages */
  if(opts.DEBUG) console.debug("Formatter domaine=%s, message : %O (opts: %O)", domaineAction, message, opts)

  return formatteurMessage.formatterMessage(kind, message, {...opts, domaine: domaineAction})
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
    if(DEBUG) console.debug("resultat chiffrage : %O", resultat)

    // Signer la commande de maitre des cles
    if(formatteurMessage) {
      const partition = resultat.commandeMaitrecles['_partition']
      const commandeCle = {...resultat.commandeMaitrecles, '_partition': undefined}
      const commandeMaitrecles = await formatterMessage(
        commandeCle, 'MaitreDesCles', 
        {kind: MESSAGE_KINDS.KIND_COMMANDE, action: 'sauvegarderCle', ajouterCertificat: true, DEBUG}
      )
      commandeMaitrecles['attachements'] = {partition}
      resultat.commandeMaitrecles = commandeMaitrecles
    }

    return resultat
}

/**
 * Chiffrage de document en utilisant la commande signee d'ajout de domaines pour la cle.
 * @param {Object} doc 
 * @param {string} domaine 
 * @param {*} certificatsChiffragePem 
 * @param {Object} opts 
 * @returns 
 */
export async function chiffrerChampsV2(doc, domaine, certificatsChiffragePem, opts) {
  opts = opts || {}
  const { DEBUG } = opts
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

  const clePubliqueCa = certificatMillegrille.cert.publicKey.publicKeyBytes
  console.debug("Cle publique CA : %O", clePubliqueCa)

  const resultat = await chiffrage.chiffrerChampsV2(doc, domaine, clePubliqueCa, certificatsListeChiffrage, opts)
  if(DEBUG) console.debug("resultat chiffrage : %O", resultat)

  // Signer la commande de maitre des cles
  if(formatteurMessage) {
    const commandeMaitrecles = await formatterMessage(
      resultat.commandeMaitrecles, 'MaitreDesCles', 
      {kind: MESSAGE_KINDS.KIND_COMMANDE, action: 'ajouterCleDomaines', ajouterCertificat: true, DEBUG}
    )
    resultat.commandeMaitrecles = commandeMaitrecles
  }

  return resultat
}

export function dechiffrerDocument(ciphertext, messageCle, opts) {
  // Wrapper pour dechiffrer document, insere la cle privee locale
  throw new Error("fix me")
  // return _dechiffrerDocument(ciphertext, messageCle, _clePrivee, opts)
}

export async function dechiffrerMessage(message) {
  // Wrapper pour dechiffrer un message, insere la cle privee locale
  let contenu = message.contenu
  if(typeof(contenu) === 'string') {
    // Decoder en base64
    contenu = base64.decode('m'+contenu)
  }
  // console.debug("Formatteur Messages : %O", formatteurMessage)
  const fingerprint = formatteurMessage.fingerprint
  const dechiffrage = message.dechiffrage
  const cleChiffree = base64.decode('m' + dechiffrage.cles[fingerprint])
  const nonce = dechiffrage.nonce || (dechiffrage.header?dechiffrage.header.slice(1):null)
  const verification = dechiffrage.tag || dechiffrage.hachage
  const format = dechiffrage.format

  // console.debug("Contenu : %O, cle chiffree %O, nonce %s, verification %s, format %s", 
  //   contenu, cleChiffree, nonce, verification, format)

  const cleDechiffree = await ed25519Utils.dechiffrerCle(cleChiffree, _clePrivee)
  // console.debug("Cle dechiffree %O", cleDechiffree)

  contenu = await chiffrage.dechiffrer(cleDechiffree, contenu, {format, header: 'm'+nonce})
  // console.debug("Contenu dechiffre\n", contenu)

  // Decompresser (gzip)
  contenu = new TextDecoder().decode(pako.ungzip(contenu))
  // console.debug("Contenu decompresse\n%s", contenu)

  contenu = JSON.parse(contenu)
  // console.debug("Contenu parsed %O", contenu)

  return contenu
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
  opts = opts || {}
  const DEBUG = opts.DEBUG || false,
        batchSize = opts.batchSize || 100,
        nombreClesNonDechiffrables = opts.nombreClesNonDechiffrables || 1000

  if(!_cleMillegrille) {
    throw new Error("Cle de MilleGrille non chargee")
  }

  let nombreClesTraitees = 0,
      nombreClesRechiffrees = 0,
      nombreErreurs = 0

  let dernierePromise = null

  while(nombreClesTraitees < nombreClesNonDechiffrables) {
    const clesNonDechiffrables = await connexion.requeteClesNonDechiffrables(batchSize, nombreClesRechiffrees)

    const { cles } = clesNonDechiffrables
    if(!cles || cles.length == 0) break

    nombreClesTraitees += cles.length  // Pour eviter boucle infinie

    if(DEBUG) console.debug("Cles non dechiffrables : %O", clesNonDechiffrables)

    try {
      //const debutRechiffrage = new Date().getTime()
      const clesRechiffrees = []
      for await (const cle of cles) {
        try {
          const signature = cle.signature
          const cleBase64 = 'm'+signature.ca
          const cleDechiffree = await ed25519Utils.dechiffrerCle(cleBase64, _cleMillegrille)
          if(DEBUG) console.debug("rechiffrerAvecCleMillegrille Cle dechiffree : %O", cleDechiffree)

          // Verifier la signature si approprie
          if(signature.version === 0) { /* Rien a faire*/ }
          else {
            const signatureVerification = new SignatureDomaines(signature.domaines)
            Object.assign(signatureVerification, signature)
            try {
              await signatureVerification.verifierSecrete(cleDechiffree)
            } catch(err) {
              console.warn("rechiffrerAvecCleMillegrille Cle %s invalide, rejetee : %O", cle.cle_id, err)
              continue
            }
          }

          const cleDechiffreeBase64 = base64.encode(cleDechiffree).slice(1)  // Encoder base64 nopad, retirer 'm' multibase
          const cleComplete = {...cle, cle_secrete: cleDechiffreeBase64}
          delete cleComplete.cle  // Cleanup

          clesRechiffrees.push(cleComplete)
        } catch(err) {
            console.error("Erreur dechiffrage cle : %O", err)
            nombreErreurs++
            clesRechiffrees.push({...cle, ok: false, err: err})
        }
      }
      if(DEBUG) console.debug("Cles rechiffrees : %O", clesRechiffrees)

      const clesPretes = clesRechiffrees.filter(cle=>cle.ok!==false)
      const contenuDict = { 
        cles: clesPretes
      }

      console.debug("Contenu dict a chiffrer : ", contenuDict)

      // let messageBytes = JSON.stringify(contenuDict)
      // console.debug("Message JSON taille %d\n%s", messageBytes.length, messageBytes)
      // messageBytes = pako.deflate(new TextEncoder().encode(messageBytes), {gzip: true})
      // console.debug("Message gzip taille %d", messageBytes.length)

      // const documentChiffre = await chiffrerDocument(
      //   messageBytes, 'MaitreDesCles', pemRechiffrage, 
      //   {retourSecret: true, nojson: true, type: 'binary'}
      // )
      const documentChiffre = await chiffrerChampsV2(
        contenuDict, 'MaitreDesCles', pemRechiffrage, {gzip: true, retourSecret: true, DEBUG: false})
      console.debug("Contenu chiffre : ", documentChiffre)

      const contenu = documentChiffre.doc.data_chiffre,
            dechiffrage = { nonce: 'm' + documentChiffre.doc.nonce, format: documentChiffre.doc.format, cles: {}},
            cleSecrete = documentChiffre.cleSecrete

      // Rechiffrer cle secrete pour tous les maitres des cles
      for await (const pemChain of pemRechiffrage) {
        const forgeCert = forgePki.certificateFromPem(pemChain)
        const publicKey = forgeCert.publicKey.publicKeyBytes
        const fingerprintMaitredescles = await _hacherCertificat(forgeCert)
    
        const cleChiffree = await ed25519Utils.chiffrerCle(cleSecrete, publicKey)
        dechiffrage.cles[fingerprintMaitredescles] = cleChiffree
      }
    
      if(DEBUG) console.debug("Cle rechiffree %d bytes dechiffrage: %O", contenu.length, dechiffrage)

      dernierePromise = connexion.rechiffrerClesBatch(contenu, dechiffrage)
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

export function dechiffrerCleSecrete(cleSecreteChiffree, opts) {
  opts = opts || {}
  let cle = _clePrivee
  if(opts.cleMillegrille) cle = _cleMillegrille
  if(!cle) throw new Error("Cle privee n'est pas chargee")
  return ed25519Utils.dechiffrerCle(cleSecreteChiffree, cle)
}

export function chiffrerCleSecrete(cleSecrete, clePublique, opts) {
  opts = opts || {}
  return ed25519Utils.chiffrerCle(cleSecrete, clePublique, opts)
}

export function hacherCertificat(pem) {
  if(Array.isArray(pem)) pem = pem[0]
  const certificat = forgePki.certificateFromPem(pem)
  return _hacherCertificat(certificat)
}
