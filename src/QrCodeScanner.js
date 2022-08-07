import React, {useCallback} from 'react'
// import { QrReader } from '@blackbox-vision/react-qr-reader'
import { base64 } from 'multiformats/bases/base64'

function QrCodeScanner(props) {

  const { setData, handleScan, erreurCb } = props

  const resultCb = useCallback((result, error) => {
      if (!!result) {
          const data = handleScan(result?.text)
          setData(data)
      }
      if (!!error) {
        erreurCb(error)
      }
  }, [setData, erreurCb])

  if(!props.show) return ''

  return 'Fix me'

  // return (
  //   <QrReader
  //     constraints={{ facingMode: 'environment' }}
  //     scanDelay={300}
  //     onResult={resultCb}
  //     style={{ width: '75%', 'text-align': 'center' }}
  //   />
  // )
}

export default QrCodeScanner

const TAILLE_LIGNE = 64

export const WRAP_CSR = [
  '-----BEGIN CERTIFICATE REQUEST-----',
  '-----END CERTIFICATE REQUEST-----'
]

export const WRAP_PRIVATE_KEY = [
  '-----BEGIN PRIVATE KEY-----',
  '-----END PRIVATE KEY-----'
]

export const WRAP_ENCRYPTED_PRIVATE_KEY = [
  '-----BEGIN ENCRYPTED PRIVATE KEY-----',
  '-----END ENCRYPTED PRIVATE KEY-----'
]

export const WRAP_CERTIFICATE = [
  '-----BEGIN CERTIFICATE-----',
  '-----END CERTIFICATE-----'
]

// Scan un code QR avec contenu DER (x.509)
// Par default, converti en PEM avec wrapper pour CSR
export function handleScanDer(data, opts) {
  opts = opts || {}
  const wrapper = opts.wrapper || WRAP_CSR
  const dataB64 = base64.encode(Buffer.from(data, 'binary')).slice(1)
  return formatPem(dataB64, wrapper)
}

function formatPem(pem, wrapper) {
  let output = [wrapper[0]]
  while(pem.length > TAILLE_LIGNE) {
    output.push(pem.slice(0, TAILLE_LIGNE))
    pem = pem.slice(TAILLE_LIGNE)
  }
  output.push(pem)
  output.push([wrapper[1]])
  return output.join('\n')
}
