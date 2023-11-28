import React, {useState, useCallback, useEffect, useMemo} from 'react'
import axios from 'axios'

import Button from 'react-bootstrap/Button'
import Modal from 'react-bootstrap/Modal'

// Modal qui permet de faire un login a partir d'une application
function OuvertureSessionModal(props) {

    const { etatConnexion, etatConnexionOpts } = props

    const [show, setShow] = useState(false)
    
    const hideCb = useCallback(()=>setShow(false), [setShow])

    const annulerCb = useCallback(()=>{
        window.location = '/millegrilles'
    }, [])

    useEffect(()=>{
        if(etatConnexion) return  // Rien a faire, on est connecte
        if(etatConnexionOpts.type !== 'TransportError') return // Erreur non geree

        // Verifier si la session est expiree
        const urlVerificationSession = new URL(window.location)
        urlVerificationSession.pathname = '/auth/verifier_usager'
        axios({method: 'GET', url: urlVerificationSession.href, validateStatus: null})
            .then(reponse=>{
                const status = reponse.status
                if(status === 200) {
                    console.debug("Session valide (status: %d)", status)
                } else if(status === 401) {
                    console.debug("Session expiree (status: %d)", status)
                    setShow(true)
                } else {
                    console.warn("Session etat non gere : %O", status)
                }
            })
            .catch(err=>{
                console.error("Erreur verification session : ", err)
            })

    }, [etatConnexion, etatConnexionOpts, setShow])

    return (
        <Modal show={show} onHide={hideCb}>
            <Modal.Header>Session expiree</Modal.Header>
            <p>La session est expiree.</p>
            <p>Cliquer sur le bouton reconnecter pour poursuivre.</p>
            <Modal.Footer>
                <Button>Reconnecter</Button>
                <Button variant="dark" onClick={annulerCb}>Deconnecter</Button>
            </Modal.Footer>
        </Modal>
    )
}

export default OuvertureSessionModal
