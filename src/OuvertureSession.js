import React, {useState, useCallback, useEffect, useMemo} from 'react'
import axios from 'axios'
import base64url from 'base64url'

import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import Container from 'react-bootstrap/Container'

import { BoutonActif } from './BoutonsActifs'
import { hacherMessage } from './formatteurMessage'

// Modal qui permet de faire un login a partir d'une application
function OuvertureSessionModal(props) {

    const { workers, etatConnexion, etatConnexionOpts, usager } = props

    const [show, setShow] = useState(false)
    const [certificatValide, setCertificatValide] = useState(true)
    const [usagerCopie, setUsagerCopie] = useState()
    const [dureeSession, setDureeSession] = useState(window.localStorage.getItem('dureeSession'))
    
    const hideCb = useCallback(()=>setShow(false), [setShow])
    const onChangeDureeSession = useCallback(event=>setDureeSession(event.currentTarget.value), [setDureeSession])

    const annulerCb = useCallback(()=>{
        window.location = '/auth/deconnecter_usager'
    }, [])

    const etatConnexionEffectif = useMemo(()=>{
        if(!etatConnexionOpts) return etatConnexion

        // Si on recoit etatConnexionOpts.ok === false, la connexion est etablie (websocket) mais session est expiree (https)
        if(etatConnexionOpts.ok === false) return false
        
        // Utiliser etatConnexion directement
        return etatConnexion
    }, [etatConnexion, etatConnexionOpts])

    useEffect(()=>{
        if(usager) {
            setUsagerCopie({...usager})

            // Verifier l'etat de certificat (ne doit pas etre expire)
            if(usager.certificat) {
                verifierCertificat(workers.connexion, usager.certificat, setCertificatValide, setShow)
                    .catch(err=>console.error("OuvertureSessionModal Erreur validation certificat ", err))
            }
        }
        
    }, [workers, usager, setUsagerCopie, setCertificatValide])

    useEffect(()=>{
        if(show && !etatConnexionEffectif) return  // Rien a faire, la fenetre est affichee
        if(!show && etatConnexionEffectif) return  // Rien a faire, la fenetre est cachee

        if(show && etatConnexionEffectif) {
            // Connexion retablie, fermer la fenetre
            return setShow(false)
        }

        if( ! ['TransportError', 'SessionExpiree'].includes(etatConnexionOpts.type)) return // Erreur non geree

        if(!usagerCopie) {
            // On ne pourra pas re-authentifier, information usager perdue
            return annulerCb()
        }

        // Verifier l'etat de certificat (ne doit pas etre expire)
        if(usagerCopie.certificat) {
            verifierCertificat(workers.connexion, usagerCopie.certificat, setCertificatValide, setShow)
                .catch(err=>console.error("OuvertureSessionModal Erreur validation certificat ", err))
        }
        
        // Verifier si la session est expiree
        const urlVerificationSession = new URL(window.location)
        urlVerificationSession.pathname = '/auth/verifier_usager'
        axios({method: 'GET', url: urlVerificationSession.href, validateStatus: null})
            .then(reponse=>{
                const status = reponse.status
                if(status === 200) {
                    // console.debug("Session valide (status: %d)", status)
                } else if(status === 401) {
                    // console.debug("Session expiree (status: %d)", status)
                    setShow(true)
                } else {
                    console.warn("Session etat non gere : %O", status)
                }
            })
            .catch(err=>{
                console.error("Erreur verification session : ", err)
            })

    }, [workers, etatConnexionEffectif, etatConnexionOpts, usagerCopie, setShow, annulerCb])

    // useEffect(()=>console.debug("OuvertureSessionModal proppies ", props), [props])

    return (
        <Modal show={show} onHide={hideCb} backdrop="static" keyboard={false}>
            <ContenuModal 
                workers={workers}
                certificatValide={certificatValide}
                usager={usagerCopie}
                dureeSession={dureeSession}
                onChangeDureeSession={onChangeDureeSession}
                onHide={hideCb}
                annulerCb={annulerCb}
                />
        </Modal>
    )
}

export default OuvertureSessionModal

function ContenuModal(props) {
    const {certificatValide} = props
    if(certificatValide) return <ContenuModalAuthentifier {...props} />
    return <ContenuModalCertificatExpire {...props} />
}

export function SelectDureeSession(props) {

    const { value, onChange } = props

    const onChangeCb = useCallback(e=>{
        const valueDuree = e.currentTarget.value
        const duree = Number.parseInt(valueDuree)
        if(!isNaN(duree)) {
            onChange(e)
            window.localStorage.setItem('dureeSession', valueDuree)
        }
    })

    return (
        <Form.Group controlId="formDureeSession">
            <Form.Label>Duree de la session</Form.Label>
            <Form.Select 
                value={value}
                onChange={onChangeCb}>
                <option value='3600'>1 heure</option>
                <option value='86400'>1 jour</option>
                <option value='604800'>1 semaine</option>
                <option value='2678400'>1 mois</option>
            </Form.Select>
            <Form.Text className="text-muted">
                Apres cette periode, l'appareil va reverifier votre identite.
            </Form.Text>
        </Form.Group>
    )
}

function ContenuModalAuthentifier(props) {

    const {workers, dureeSession, onChangeDureeSession, usager, onHide, annulerCb} = props

    return (
        <div>
            <Modal.Header>Session expiree</Modal.Header>
            
            <Container>
                <p>La session est expiree.</p>
                <p>Cliquer sur le bouton reconnecter pour poursuivre.</p>

                <SelectDureeSession value={dureeSession} onChange={onChangeDureeSession} />

                {/* <Form.Group controlId="formDureeSession">
                    <Form.Label>Duree de la session</Form.Label>
                    <Form.Select 
                        value={dureeSession}
                        onChange={onChangeDureeSession}>
                        <option value='3600'>1 heure</option>
                        <option value='86400'>1 jour</option>
                        <option value='604800'>1 semaine</option>
                        <option value='2678400'>1 mois</option>
                    </Form.Select>
                    <Form.Text className="text-muted">
                        Apres cette periode, l'appareil va reverifier votre identite.
                    </Form.Text>
                </Form.Group> */}
            </Container>

            <Modal.Footer>
                <BoutonAuthentifier
                    workers={workers}
                    usager={usager}
                    dureeSession={dureeSession}
                    onSuccess={onHide}
                >
                    Reconnecter
                </BoutonAuthentifier>
                <Button variant="dark" onClick={annulerCb}>Deconnecter</Button>
            </Modal.Footer>        
        </div>
    )
}

function ContenuModalCertificatExpire(props) {
    const {annulerCb} = props
    return (
        <div>
            <Modal.Header>Session expiree</Modal.Header>
            
            <Container>
                <p>La session est expiree.</p>
                <p>Cliquer sur le bouton deconnecter pour poursuivre.</p>
            </Container>

            <Modal.Footer>
                <Button variant="dark" onClick={annulerCb}>Deconnecter</Button>
            </Modal.Footer>        
        </div>
    )
}

function BoutonAuthentifier(props) {

    const { workers, children, usager, dureeSession, setAttente, onSuccess } = props

    const [usagerWebAuth, setUsagerWebAuth] = useState('')

    const challengeWebauthn = useMemo(()=>{
        if(usagerWebAuth && usagerWebAuth.infoUsager) {
            const challenge = usagerWebAuth.infoUsager.authentication_challenge
            // console.debug("Authentifier.challengeWebauthn ", challenge)
            return challenge
        }
    }, [usagerWebAuth])
    
    const onSuccessWebAuth = useCallback(value=>{
        // console.debug("BoutonAuthentifier succes auth : ", value)
        onSuccess()  // Ferme la fenetre
    }, [onSuccess])

    const erreurCb = useCallback(err=>{
        console.error("BoutonAuthentifier Erreur", err)
    }, [])

    useEffect(()=>{
        const nomUsager = usager.nomUsager
        const fingerprintCourant = usager.fingerprintPk
        const fingerprintPk = null

        chargerUsager(nomUsager, fingerprintPk, fingerprintCourant, {genererChallenge: true})
         .then(reponseUsagerWebAuth=>{
            // console.debug("BoutonAuthentifier Reponse usager webauthn : ", reponseUsagerWebAuth)
            setUsagerWebAuth(reponseUsagerWebAuth)
         })
         .catch(erreurCb)
    }, [usager, setUsagerWebAuth, erreurCb])

    return (
        <BoutonAuthentifierWebauthn 
            workers={workers}
            usager={usager}
            challenge={challengeWebauthn}
            setAttente={setAttente}
            onSuccess={onSuccessWebAuth}
            onError={erreurCb}
            dureeSession={dureeSession}
        >
            {children}
        </BoutonAuthentifierWebauthn>
    )
}

function BoutonAuthentifierWebauthn(props) {

    const { workers, variant, className, usager, challenge, dureeSession, onError, onSuccess } = props

    // console.debug("BoutonAuthentifierWebauthn usagerDb %O", usager)

    const { connexion } = workers
    // const { requete: requeteCsr } = usagerDbLocal
    const [nomUsager, requeteCsr] = useMemo(()=>{
        if(!usager) return [null, null]
        return [usager.nomUsager, usager.requete]
    }, [usager])

    const [reponseChallengeAuthentifier, setReponseChallengeAuthentifier] = useState('')
    const [attente, setAttente] = useState(false)
    const [erreur, setErreur] = useState(false)
    const handlerErreur = useCallback((err, message)=>{
        setErreur(true)
        onError(err, message)
    }, [setErreur, onError])

    const authentifierCb = useCallback( event => {
        // console.debug("BoutonAuthentifierWebauthn.authentifierCb Authentifier nomUsager: %s, reponseChallengeAuthentifier: %O", 
        //     nomUsager, reponseChallengeAuthentifier)
        setErreur(false)  // Reset
        setAttente(true)
        const {demandeCertificat, publicKey} = reponseChallengeAuthentifier
        authentifier(connexion, nomUsager, demandeCertificat, publicKey, {dureeSession})
            .then(reponse=>{
                // console.debug("BoutonAuthentifierWebauthn Reponse authentifier ", reponse)
                onSuccess(reponse)
            })
            .catch(err=>handlerErreur(err, 'BoutonAuthentifierWebauthn.authentifierCb Erreur authentification'))
            .finally(()=>{setAttente(false)})
    }, [connexion, nomUsager, dureeSession, reponseChallengeAuthentifier, onSuccess, setAttente, setErreur, handlerErreur])

    useEffect(()=>{
        if(!challenge) return
        preparerAuthentification(nomUsager, challenge, requeteCsr)
            .then(resultat=>{
                // console.debug("Reponse preparerAuthentification nomUsager %s, challenge %O, requeteCsr %s : %O", nomUsager, challenge, requeteCsr, resultat)
                setReponseChallengeAuthentifier(resultat)
            })
            .catch(err=>onError(err, 'BoutonAuthentifierWebauthn.authentifierCb Erreur preparation authentification'))
    }, [nomUsager, challenge, requeteCsr, setReponseChallengeAuthentifier, onError])

    let etatBouton = ''
    if(erreur) etatBouton = 'echec'
    else if(attente) etatBouton = 'attente'

    return (
        <BoutonActif 
            variant={variant} 
            className={className} 
            challenge={challenge}
            etat={etatBouton}
            onClick={authentifierCb}
            disabled={reponseChallengeAuthentifier?false:true}
        >
            {props.children}
        </BoutonActif>
    )
}

export async function preparerAuthentification(nomUsager, challengeWebauthn, requete, opts) {
    opts = opts || {}
    if(!challengeWebauthn) throw new Error("preparerAuthentification challengeWebauthn absent")
    // console.debug("Preparer authentification avec : ", challengeWebauthn)

    const challengeReference = challengeWebauthn.publicKey.challenge
    const publicKey = {...challengeWebauthn.publicKey}

    // Decoder les champs base64url
    publicKey.challenge = base64url.toBuffer(publicKey.challenge)
    publicKey.allowCredentials = (publicKey.allowCredentials || []).map(cred=>{
        const idBytes = base64url.toBuffer(cred.id)
        return {
            ...cred,
            id: idBytes
        }
    })

    let demandeCertificat = null
    if(requete) {
        const csr = requete.csr || requete
        // console.debug("On va hacher le CSR et utiliser le hachage dans le challenge pour faire une demande de certificat")
        // if(props.appendLog) props.appendLog(`On va hacher le CSR et utiliser le hachage dans le challenge pour faire une demande de certificat`)
        demandeCertificat = {
            nomUsager,
            csr,
            date: Math.floor(new Date().getTime()/1000)
        }
        if(opts.activationTierce === true) demandeCertificat.activationTierce = true
        const hachageDemandeCert = await hacherMessage(demandeCertificat, {bytesOnly: true, hashingCode: 'blake2s-256'})
        // console.debug("Hachage demande cert %O = %O, ajouter au challenge existant de : %O", hachageDemandeCert, demandeCertificat, publicKey.challenge)
        
        // Concatener le challenge recu (32 bytes) au hachage de la commande
        // Permet de signer la commande de demande de certificat avec webauthn
        const challengeMaj = new Uint8Array(64)
        challengeMaj.set(publicKey.challenge, 0)
        challengeMaj.set(hachageDemandeCert, 32)
        publicKey.challenge = challengeMaj

        //challenge[0] = CONST_COMMANDE_SIGNER_CSR
        //challenge.set(hachageDemandeCert, 1)  // Override bytes 1-65 du challenge
        // console.debug("Challenge override pour demander signature certificat : %O", publicKey.challenge)
        // if(props.appendLog) props.appendLog(`Hachage demande cert ${JSON.stringify(hachageDemandeCert)}`)
    } 
    // else if(challenge[0] !== CONST_COMMANDE_AUTH) {
    //     console.error("Challenge[0] : %d !== %d", challenge[0], CONST_COMMANDE_AUTH)
    //     throw new Error("Erreur challenge n'est pas de type authentification (code!==1)")
    // }        

    const resultat = { publicKey, demandeCertificat, challengeReference }
    // console.debug("Prep publicKey/demandeCertificat : %O", resultat)
    
    return resultat
}

async function authentifier(connexion, nomUsager, demandeCertificat, publicKey, opts) {
    // N.B. La methode doit etre appelee par la meme thread que l'event pour supporter
    //      TouchID sur iOS.
    // console.debug("Signer challenge : %O (opts: %O)", publicKey, opts)
    // if(opts.appendLog) opts.appendLog(`Signer challenge`)

    opts = opts || {}
    const { dureeSession } = opts

    if(!nomUsager) throw new Error("authentifier Nom usager manquant")  // Race condition ... pas encore trouve

    const data = await signerDemandeAuthentification(nomUsager, demandeCertificat, publicKey, {connexion, dureeSession})

    // console.debug("Data a soumettre pour reponse webauthn : %O", data)
    // const resultatAuthentification = await connexion.authentifierWebauthn(data, opts)
    // console.debug("Resultat authentification : %O", resultatAuthentification)
    // // const contenu = JSON.parse(resultatAuthentification.contenu)

    // console.debug("Data a soumettre pour reponse webauthn : %O", data)
    const resultatAuthentification = await axios.post('/auth/authentifier_usager', data)
    // console.debug("Resultat authentification : %O", resultatAuthentification)
    const reponse = resultatAuthentification.data
    const contenu = JSON.parse(reponse.contenu)

    if(contenu.userId) {
        return contenu
    } else {
        throw new Error("WebAuthn.authentifier Erreur authentification")
    }
}

export async function signerDemandeAuthentification(nomUsager, demandeCertificat, publicKey, opts) {
    opts = opts || {}
    // const connexion = opts.connexion
    // N.B. La methode doit etre appelee par la meme thread que l'event pour supporter
    //      TouchID sur iOS.
    // console.debug("Signer challenge : %O (challengeWebauthn %O, opts: %O)", publicKey, challengeWebauthn, opts)
    // if(opts.appendLog) opts.appendLog(`Signer challenge`)

    if(!nomUsager) throw new Error("signerDemandeAuthentification Nom usager manquant")  // Race condition ... pas encore trouve

    let { dureeSession } = opts
    if(typeof(dureeSession) === 'string') {
        dureeSession = Number.parseInt(dureeSession)
    }

    // S'assurer qu'on a un challenge de type 'authentification'
    // const demandeCertificat = opts.demandeCertificat?opts.demandeCertificat:null
    const data = {nomUsager, demandeCertificat}
    if(dureeSession) data.dureeSession = dureeSession
    
    const publicKeyCredentialSignee = await navigator.credentials.get({publicKey})
    // console.debug("PublicKeyCredential signee : %O", publicKeyCredentialSignee)
    // if(opts.appendLog) opts.appendLog(`PublicKeyCredential signee : ${JSON.stringify(publicKeyCredentialSignee)}`)

    const reponseSignee = publicKeyCredentialSignee.response

    const reponseSerialisable = {
        // id: publicKeyCredentialSignee.rawId,
        // id64: base64.encode(new Uint8Array(publicKeyCredentialSignee.rawId)),  // String.fromCharCode.apply(null, multibase.encode('base64', new Uint8Array(publicKeyCredentialSignee.rawId))),
        id64: base64url.encode(new Uint8Array(publicKeyCredentialSignee.rawId)),
        response: {
            // authenticatorData: reponseSignee.authenticatorData?base64.encode(new Uint8Array(reponseSignee.authenticatorData)):null,
            // clientDataJSON: reponseSignee.clientDataJSON?base64.encode(new Uint8Array(reponseSignee.clientDataJSON)):null,
            // signature: reponseSignee.signature?base64.encode(new Uint8Array(reponseSignee.signature)):null,
            // userHandle: reponseSignee.userHandle?base64.encode(new Uint8Array(reponseSignee.userHandle)):null,

            authenticatorData: reponseSignee.authenticatorData?base64url.encode(new Uint8Array(reponseSignee.authenticatorData)):null,
            clientDataJSON: reponseSignee.clientDataJSON?base64url.encode(new Uint8Array(reponseSignee.clientDataJSON)):null,
            signature: reponseSignee.signature?base64url.encode(new Uint8Array(reponseSignee.signature)):null,
            userHandle: reponseSignee.userHandle?base64url.encode(new Uint8Array(reponseSignee.userHandle)):null,
        },
        type: publicKeyCredentialSignee.type,
    }

    // console.debug("Reponse serialisable : %O", reponseSerialisable)

    data.webauthn = reponseSerialisable
    data.challenge = publicKey.challenge

    return data
}

async function chargerUsager(nomUsager, fingerprintPk, fingerprintCourant, opts) {
    opts = opts || {}
    const hostname = window.location.hostname
    const data = {
        nomUsager, hostname, 
        ...opts, 
        fingerprintPkNouveau: fingerprintPk, fingerprintPkCourant: fingerprintCourant
    }
    // console.debug("Charger usager data : %O", data)
    const reponse = await axios({method: 'POST', url: '/auth/get_usager', data, timeout: 20_000})
    const reponseEnveloppe = reponse.data
    const infoUsager = JSON.parse(reponseEnveloppe.contenu)
    // console.debug("chargerUsager Reponse ", infoUsager)
    const authentifie = infoUsager?infoUsager.auth:false
    return {nomUsager, infoUsager, authentifie}
}

async function verifierCertificat(connexion, certificat, setCertificatValide, setShow) {
    try {
        // const dateValidation = new Date(2023, 11, 30, 0, 0, 0)
        const dateValidation = new Date()
        const certificatValide = await connexion.validerCertificat(certificat, dateValidation)
        // console.debug("Resultat validation certificat usager ", certificatValide)
        setCertificatValide(certificatValide)
        if(certificatValide === false) setShow(true)  // Afficher modal pour deconnecter
    } catch(err) {
        console.error("Erreur validation certificat ", err)
        setCertificatValide(false)
        setShow(true)
    }
}
