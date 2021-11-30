import { pki as forgePki } from 'node-forge'
import { forgecommon, validateurMessage } from '@dugrema/millegrilles.utiljs'

const { CertificateStore } = forgecommon
const { verifierMessage: _verifierMessage } = validateurMessage

var _certificatCaForge = null,
    _certificateStore = null

export function init(caPem) {
  console.debug("Init x509Client")
  _certificatCaForge = forgePki.certificateFromPem(caPem)
  console.debug("Certificat Store class : %O\nCert forge : %O", CertificateStore, _certificatCaForge)
  _certificateStore = new CertificateStore(_certificatCaForge)
}

export function verifierCertificat(chainePem, dateValidation) {
  return _certificateStore.verifierChaine(chainePem, {validityCheckDate: dateValidation})
}

export async function verifierMessage(message) {
  const certificat = message['_certificat']
  const estampille = new Date(message['en-tete'].estampille * 1000)
  const certValide = verifierCertificat(certificat, estampille)

  if(!certValide) {
    var err = new Error("Certificat invalide")
    err.code = 1
    err.fields = ['_certificat']
    throw err
  }

  try {
    const certForge = forgePki.certificateFromPem(certificat[0])
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
