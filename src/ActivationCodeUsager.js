import React, {useState, useEffect, useCallback} from 'react'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import Tab from 'react-bootstrap/Tab'
import Tabs from 'react-bootstrap/Tabs'
import Alert from 'react-bootstrap/Alert'

import { pki } from '@dugrema/node-forge'

import QrCodeScanner, {handleScanDer} from './QrCodeScanner'

export function AfficherActivationsUsager(props) {
    const {workers, nomUsager, csrCb, supportCodeQr, erreurCb} = props
  
    const [csr, setCsr] = useState('')
    const [nomUsagerCsr, setNomUsagerCsr] = useState('')

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
            <SelecteurSaisie
                workers={workers}
                nomUsager={nomUsager}
                supportCodeQr={supportCodeQr}
                setCsr={setCsr}
                setNomUsagerCsr={setNomUsagerCsr}
                erreurCb={erreurCb} />

            <br />
            <Alert variant="danger" show={csr&&!nomUsagerMatchCsr}>
                <p>Le code recu ({nomUsagerCsr}) ne correspond pas au compte {nomUsager}</p>
            </Alert>
            <Alert variant="success" show={nomUsagerMatchCsr?true:false}>
                <p>Code du compte {nomUsagerCsr} pret</p>
            </Alert>
 
        </div>
    )
}

function SelecteurSaisie(props) {
    const { supportCodeQr, workers, nomUsager, setCsr, setNomUsagerCsr, erreurCb } = props

    const [showScanner, setShowScanner] = useState(false)
    const showScannerOn = useCallback(()=>setShowScanner(true))

    if(!supportCodeQr) {
        return (
            <CodeTexte 
                workers={workers}
                nomUsager={nomUsager}
                setCsr={setCsr}
                setNomUsagerCsr={setNomUsagerCsr}
                erreurCb={erreurCb} />
        )
    } else {
        return (
            <Tabs defaultActiveKey="qr" id="tab-code">
                <Tab eventKey="qr" title="Code QR">
                    <Button variant="secondary" onClick={showScannerOn}>Scan code QR</Button>
                    <ScannerCode 
                        setCsr={setCsr}
                        showScanner={showScanner}
                        setShowScanner={setShowScanner} />

                </Tab>
                <Tab eventKey="activation" title="Code activation">
                    <CodeTexte 
                        workers={workers}
                        nomUsager={nomUsager}
                        setCsr={setCsr}
                        setNomUsagerCsr={setNomUsagerCsr}
                        erreurCb={erreurCb} />
                </Tab>
            </Tabs>            
        )
    }
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
                <Col sm={6} md={3} lg={2}>Compte</Col>
                <Col>{nomUsager}</Col>
            </Row>
            <Row>
                <Form.Label column={true} md={2}>Code</Form.Label>
                <Col sm={6} md={3} lg={2}>
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
    if(reponse.ok === false) throw new Error(reponse.err)
    return reponse.csr
}
  
export function getNomUsagerCsr(csrPem) {
    try {
        const csrForge = pki.certificationRequestFromPem(csrPem)
        const cn = csrForge.subject.getField('CN').value
        return cn
    } catch(err) {
        console.warn("Erreur chargement CSR : %O", err)
        return null
    }
}
  