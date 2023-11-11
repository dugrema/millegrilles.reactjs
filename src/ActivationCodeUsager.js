import React, {useState, useEffect, useCallback} from 'react'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import Tab from 'react-bootstrap/Tab'
import Tabs from 'react-bootstrap/Tabs'

import { pki } from '@dugrema/node-forge'

import { BoutonActif } from './BoutonsActifs'

import QrCodeScanner, { decodeCsrToPem } from './QrCodeScanner'

export function AfficherActivationsUsager(props) {
    const {workers, nomUsager, csrCb, supportCodeQr, erreurCb} = props
  
    const [csr, setCsr] = useState('')

    // Charger le nom de l'usager dans le CSR
    useEffect(()=>{
        if(csr) {
            const nomUsagerCsr = getNomUsagerCsr(csr)

            if(nomUsagerCsr!==nomUsager) {
                erreurCb(`Le code recu (${nomUsagerCsr}) ne correspond pas au compte ${nomUsager}`)
                return
            }

            if(nomUsager === nomUsagerCsr) {
                csrCb(csr)
            }

            setCsr('')  // Reset
        }
    }, [nomUsager, csr, csrCb, erreurCb])
  
    return (
        <div>
            <SelecteurSaisie
                workers={workers}
                nomUsager={nomUsager}
                supportCodeQr={supportCodeQr}
                setCsr={setCsr}
                erreurCb={erreurCb} />
            <br />
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
                    <ScannerCodeCsr 
                        onScan={setCsr}
                        onError={erreurCb} 
                        label='Scan' />

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

    const { workers, nomUsager, csr, setCsr, erreurCb } = props

    const [code, setCode] = useState('')
    const [etatBouton, setEtatBouton] = useState('')

    const verifierCb = useCallback(()=>{
        // Recuperer le CSR correspondant au compte/code
        setEtatBouton('attente')
        const codeFormatte = formatterCode(code, erreurCb)
        if(!codeFormatte) {
            setEtatBouton('echec')
            return
        }
        setCode(codeFormatte)
        verifierCode(workers, codeFormatte, nomUsager)
            .then(csr=>{
                if(csr) {
                    setEtatBouton('succes')
                    setCsr(csr)
                } else {
                    setEtatBouton('echec')
                }
            })
            .catch(err=>{
                console.warn("ActivationCodeUsager.AfficherActivationsUsager - s'assurer d'avoir une methode connexion.getRecoveryCsr(code)")
                setEtatBouton('echec')
                erreurCb(err)
            })
    }, [workers, nomUsager, code, csr, setCode, setCsr, setEtatBouton, erreurCb])
  
    const changerCodeCb = useCallback(event => {
        setCsr('')
        setEtatBouton('')
  
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
    }, [setCode, setCsr, setEtatBouton])

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
                    <BoutonActif 
                        variant="secondary" 
                        etat={etatBouton} 
                        onClick={verifierCb}>
                            Verifier code
                    </BoutonActif>
                </Col>
            </Row>
        </div>
    )
}

function ScannerCodeCsr(props) {
    const { label, onScan, onError } = props

    const handlerScan = (data, _dataJson) => {
        try {
            const csr = decodeCsrToPem(data)
            onScan(csr)
        } catch(err) {
            if(onError) onError(err, 'ScannerCodeCsr Erreur lecture CSR')
        }
    }

    return (
        <QrCodeScanner 
            label={label}
            onScan={handlerScan}
            onError={onError} />
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
  