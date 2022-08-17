import React from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { base64 } from 'multiformats/bases/base64'

function QrCodeScanner(props) {

  const { onScan, onError } = props

  const qrbox = props.qrbox || 250,
        fps = props.fps || 10

  return (
    <ErrorBoundary erreurCb={erreurCb}>
      <Html5QrcodeModal 
          fps={fps}
          qrbox={qrbox}
          disableFlip={false}
          qrCodeSuccessCallback={onScan} 
          erreurCb={onError} />
    </ErrorBoundary>
  )

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

function Html5QrcodeModal(props) {

  const { qrCodeSuccessCallback } = props

  const [running, setRunning] = useState(false)
  const [entered, setEntered] = useState(false)
  const handlerStop = () => {
      setRunning(false)
      setEntered(false)
  }
  const handlerStart = () => setRunning(true)
  const handlerEntered = () => setEntered(true)

  const handlerSuccess = (decodedText, decodedResult) => {
      qrCodeSuccessCallback(decodedText, decodedResult)
      setRunning(false)
  }

  return (
      <div>
          <Button onClick={handlerStart} disabled={!!running}>Start</Button>
          <Modal show={running} fullscreen={true} onEntered={handlerEntered} onHide={handlerStop}>
              <Modal.Header closeButton>Scanner QR</Modal.Header>
              <Html5QrcodeRunner {...props} 
                  running={entered} 
                  qrCodeSuccessCallback={handlerSuccess} />
          </Modal>
      </div>
  )
}

function Html5QrcodeRunner(props) {

  const {running, qrCodeSuccessCallback, erreurCb} = props

  useEffect(()=>{
      if(!running) return

      const html5QrCodeInstance = new Html5Qrcode(qrcodeRegionId)
      const config = createConfig(props)
      const facingMode = 'environment'
      let promiseStart = null
      try {
          promiseStart = html5QrCodeInstance.start(
              {facingMode},
              config,
              qrCodeSuccessCallback,
              erreurCb
          )
          .catch(err=>erreurCb(err, 'Html5QrcodeRunner promise catch'))
      } catch(err) {
          erreurCb(err, "Html5QrcodeRunner try/catch")
      }

      // Cleanup
      return () => {
          try {
              if(promiseStart) {
                  promiseStart.then(()=>html5QrCodeInstance.stop())
                    .catch(err=>console.debug("Html5QrcodeRunner Erreur fermeture scanner QR : %O", err))
              }
          } catch(err) {
              console.error("Html5QrcodeRunner Promise stop erreur : %O", err)
          }
      }
  }, [running, qrCodeSuccessCallback, erreurCb])

  return (
      <Row className='qr-viewer'>
          <Col xs={1} sm={2} md={3} lg={4}></Col>
          <Col xs={10} sm={8} md={6} lg={4}>
              <div id={qrcodeRegionId} />
          </Col>
      </Row>
  )
}


function createConfig(props) {
  var config = {
      fpt: props.fpt || 10,
      qrbox: props.qrbox || {width: 250, height: 250},
  }
  if (props.aspectRatio) {
      config.aspectRatio = props.aspectRatio;
  }
  if (props.disableFlip !== undefined) {
      config.disableFlip = props.disableFlip;
  }

  return config;
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.props.erreurCb(error)
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }

    return this.props.children; 
  }
}

// Decode un code QR avec contenu binaire (e.g. DER pour x.509)
function decodeTextToBuffer(data, lineLength) {
  lineLength = lineLength || 64
  const buffer = Uint8Array.from(data.split("").map(x => x.charCodeAt()))
  let bufferBase64 = base64.encode(buffer).slice(1)

  let bufferOutput = []
  while(bufferBase64.length > 0) {
      const len = Math.min(lineLength, bufferBase64.length)
      bufferOutput.push(bufferBase64.slice(0, len))
      bufferBase64 = bufferBase64.slice(len)
  }

  return bufferOutput.join('\n')
}

// Decode un code QR binaire et retourne un CSR en format PEM
export function decodeCsrToPem(data) {
  return [
    WRAP_CSR[0],
    decodeTextToBuffer(data, 64),
    WRAP_CSR[1]
  ].join('\n')
}
