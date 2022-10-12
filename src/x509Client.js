import { pki as forgePki } from '@dugrema/node-forge'
// import { forgecommon, validateurMessage, getIdmg } from '@dugrema/millegrilles.utiljs/src/index'

import { getIdmg } from '@dugrema/millegrilles.utiljs/src/idmg'
import { CertificateStore } from '@dugrema/millegrilles.utiljs/src/forgecommon'
import { verifierMessage as _verifierMessage } from '@dugrema/millegrilles.utiljs/src/validateurMessage'

// const { CertificateStore } = forgecommon
// const { verifierMessage: _verifierMessage } = validateurMessage
// const { getIdmg } = idmg

var _certificatCaForge = null,
    _certificateStore = null,
    _idmgLocal = ''

export async function init(caPem) {
  // console.debug("Init x509Client")
  _certificatCaForge = forgePki.certificateFromPem(caPem)
  // console.debug("Certificat Store class : %O\nCert forge : %O", CertificateStore, _certificatCaForge)
  _certificateStore = new CertificateStore(_certificatCaForge)

  const idmg = await getIdmg(caPem)
  _idmgLocal = idmg
}

export function getIdmgLocal() {
  return _idmgLocal
}

export function verifierCertificat(chainePem, dateValidation) {
  return _certificateStore.verifierChaine(chainePem, {validityCheckDate: dateValidation})
}

export function validerCertificat(chainePem, dateValidation) {
  const certificatValide = _certificateStore.verifierChaine(chainePem, {validityCheckDate: dateValidation})
  // verifierChaine retourne false si le certificat est invalide, un objet si valide
  if(certificatValide) {
    // console.debug("Certificat valide : %O", certificatValide)
    return true
  }
  return false
}

export async function verifierMessage(message, opts) {
  opts = opts || {}
  const support_idmg_tiers = opts.support_idmg_tiers?true:false

  const certificat = message['_certificat'],
        certMillegrille = message['_millegrille']
  const entete = message['en-tete'] || {},
        estampilleInt = entete.estampille,
        idmg = entete.idmg

  const estampille = new Date(estampilleInt * 1000)
  let certValide = false
  if(!idmg || idmg === _idmgLocal) {
    // Utiliser store avec CA local
    certValide = verifierCertificat(certificat, estampille)
  } else if(support_idmg_tiers && certMillegrille) {
    const certCaForge = forgePki.certificateFromPem(certMillegrille)
    const certificatStore = new CertificateStore(certCaForge)
    certValide = certificatStore.verifierChaine(certificat, {validityCheckDate: estampille})
  } else {
    // console.warn("Erreur validation, aucun match : idmg message %s, idmg local %s", idmg, _idmgLocal)
    throw new Error(`x509Client.verifierMessage idmg tiers non supporte ou sans certificat _millegrille : idmg message ${idmg}`)
  }

  if(!certValide) {
    var err = new Error("Certificat invalide")
    err.code = 1
    err.fields = ['_certificat']
    throw err
  }

  try {
    const certForge = forgePki.certificateFromPem(certificat[0])
    // console.debug("Cert forge : ", certForge)
    await _verifierMessage(message, certForge)
  } catch(err) {
    console.error("Erreur validation message", err)
    const errObj = new Error(''+err)
    errObj.cause = err
    errObj.code = 2
    errObj.fields = ['hachage_contenu', '_signature']
    throw errObj
  }

  return true
}
