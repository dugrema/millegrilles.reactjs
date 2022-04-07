import React, {useState, useEffect, useCallback} from 'react'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'

import { pki } from '@dugrema/node-forge'

import QrCodeScanner, {handleScanDer} from './QrCodeScanner'

export function AfficherActivationsUsager(props) {
    const {workers, nomUsager, setSectionGestion, confirmationCb, erreurCb, csrCb, supportCodeQr} = props
  
    const [csr, setCsr] = useState('')
    const [nomUsagerCsr, setNomUsagerCsr] = useState('')
    const [showScanner, setShowScanner] = useState(false)
  
    const retourCb = useCallback(()=>setSectionGestion(''), [setSectionGestion])
  
    const showScannerOn = useCallback(()=>setShowScanner(true))

    const toggleScanner = useCallback(event=>{
        const checked = event.currentTarget.checked
        console.debug("Etat checked : %O", checked)
        setShowScanner(checked)
    }, [setShowScanner])
  
    const scannerCb = useCallback(csrPem=>{
        console.debug("Scanner resultat : %O", csrPem)
        erreurCb(csrPem, 'Resultat OK!')
  
        // Verifier CSR
        const nomUsagerCsr = getNomUsagerCsr(csrPem)
        if(nomUsagerCsr === nomUsager) {
            csrCb(csrPem)
            confirmationCb('Code QR lu avec succes')
            setShowScanner(false)
        }
  
    }, [nomUsager, csrCb, confirmationCb, erreurCb, setShowScanner])
  
 
    // Charger le nom de l'usager dans le CSR
    useEffect(()=>{
        if(csr) {
            const nomUsagerCsr = getNomUsagerCsr(csr)
            setNomUsagerCsr(nomUsagerCsr)
            if(nomUsager === nomUsagerCsr) {
                csrCb(csr)
            }
        }
    }, [nomUsager, csr, setNomUsagerCsr, csrCb, erreurCb])
  
    const nomUsagerMatchCsr = csr?nomUsagerCsr===nomUsager:false
  
    return (
        <div>
            <CodeTexte 
                workers={workers}
                nomUsager={nomUsager}
                setCsr={setCsr}
                setNomUsagerCsr={setNomUsagerCsr}
                erreurCb={erreurCb} />

            <Row>
                <Col xs={6} sm={4} md={3} lg={2}>Compte recu</Col>
                <Col xs={6} sm={4} md={3} lg={2}>
                    {nomUsagerCsr}{' '}
                </Col>
                <Col xs={6} sm={4} md={3} lg={2}>
                    {csr&&!nomUsagerMatchCsr?
                        'Erreur - les comptes ne correspondent pas'
                        :csr?'(OK)':''
                    }
                </Col>
            </Row>
  
            <h3>Scanner le code QR</h3>
  
            <p>Il est aussi possible d'activer en scannant le code QR affiche sur votre autre appareil.</p>
  
            <Button onClick={showScannerOn}>Scan code QR</Button>

            <ScannerCode 
                setCsr={setCsr}
                showScanner={showScanner}
                setShowScanner={setShowScanner} />
        </div>
    )
}
  
function CodeTexte(props) {

    const { workers, nomUsager, csr, setCsr, setNomUsagerCsr, erreurCb } = props

    const [code, setCode] = useState('')

    const verifierCb = useCallback(()=>{
        // Recuperer le CSR correspondant au compte/code
        const codeFormatte = formatterCode(code, erreurCb)
        setCode(codeFormatte)
        verifierCode(workers, codeFormatte, nomUsager)
            .then(csr=>{
                if(csr) {
                    setCsr(csr)
                }
            })
            .catch(err=>{
                console.warn("ActivationCodeUsager.AfficherActivationsUsager - s'assurer d'avoir une methode connexion.getRecoveryCsr(code)")
                erreurCb(err)
            })
    }, [workers, nomUsager, code, csr, setCode, setCsr, erreurCb])
  
    const changerCodeCb = useCallback(event => {
        setCsr('')
        setNomUsagerCsr('')
  
        const code = event.currentTarget.value
        if(code) {
            let codeModifie = code.replaceAll('-', '')
            if(codeModifie.length > 8) {
                // Annuler changement
            } else if(code.length -1 > codeModifie.length) {
                // Annuler changement
            } else {
                setCode(code)
            }
        } else {
            setCode(code)
        }
    }, [setCode, setCsr, setNomUsagerCsr])

    return (
        <div>
            <Row>
                <Col xs={8} sm={6} md={3} lg={2}>Compte</Col>
                <Col>{nomUsager}</Col>
            </Row>
            <Row>
                <Form.Label column={true} md={2}>Code</Form.Label>
                <Col xs={8} sm={6} md={3} lg={2}>
                    <Form.Control 
                        type="text" 
                        placeholder="abcd-1234" 
                        value={code}
                        onChange={changerCodeCb} />
                </Col>
                <Col>
                    <Button variant="secondary" onClick={verifierCb}>Verifier code</Button>
                </Col>
            </Row>
        </div>
    )
}

function ScannerCode(props) {
    const { showScanner, setShowScanner, setCsr } = props

    const fermer = useCallback(()=>setShowScanner(false), [setShowScanner])

    const setDataCb = useCallback(data=>{
        setCsr(data)
        setShowScanner(false)
    }, [setCsr, setShowScanner])

    return (
        <Modal show={showScanner} fullscreen="true" onHide={fermer}>

            <Modal.Header closeButton>
                <Modal.Title>QR Code</Modal.Title>
            </Modal.Header>

            <QrCodeScanner 
                show={showScanner} 
                handleScan={handleScanDer}
                setData={setDataCb} 
                erreurCb={()=>{}} />

        </Modal>
    )
}


function formatterCode(code, erreurCb) {
    let codeClean = code.replaceAll('-', '')
    if(codeClean.length !== 8) {
        return erreurCb('Longueur du code est invalide (doit etre 8 characteres, e.g. jdzl-a7u7)')
    }
    let code1 = codeClean.slice(0, 4),
        code2 = codeClean.slice(4)
    const codeModifie = [code1, code2].join('-')
    return codeModifie
}
  
async function verifierCode(workers, code, nomUsager) {
    const { connexion } = workers
    const reponse = await connexion.getRecoveryCsr(code, nomUsager)
    console.debug("Reponse verifier code : %O", reponse)
    if(reponse.ok === false) throw new Error(reponse.err)
    return reponse.csr
}
  
export function getNomUsagerCsr(csrPem) {
    try {
        console.debug("Charger pem csr : %O", csrPem)
        const csrForge = pki.certificationRequestFromPem(csrPem)
        console.debug("CSR Forge : %O", csrForge)
  
        const cn = csrForge.subject.getField('CN').value
        console.debug("Common name : %O", cn)
  
        return cn
    } catch(err) {
        console.warn("Erreur chargement CSR : %O", err)
        return null
    }
}
  