import React, {useState, useEffect, useCallback} from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Modal from 'react-bootstrap/Modal'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

export function AlertTimeout(props) {

    // const message = props.message,
    //       setMessage = props.setMessage,
    //       setError = props.setError,
    //       err = props.err
          // delay = props.delay || 10000,

    const {value, setValue} = props
    const titre = props.titre || 'Succes'
    const variant = props.variant || 'success'

    let delay = props.delay
    if(delay !== false && !delay) delay = 10000

    const [timeoutAlert, setTimeoutAlert] = useState('')
    const [afficherStack, setAfficheStack] = useState(false)

    const [message, setMessage] = useState('')
    const [err, setErr] = useState('')

    const closeCb = useCallback(()=>{ setValue('') }, [setValue])
    const afficherStackCb = useCallback(()=>setAfficheStack(true), [setAfficheStack])

    // Reset afficher stack sur changement de valeur
    useEffect(()=>setAfficheStack(false), [value, setAfficheStack])

    useEffect(()=>{
        console.info("Alerts value : %O", value)
        if(value) {
            if(value.message) {
                setMessage(value.message)
            } else if(typeof(value) === 'string') {
                setMessage(value)
            } else if(value.err) {
                setMessage(''+value.err)
            }
            if(value.err) {
                setErr(value.err)
            }
        } else {
            // Cleanup
            setMessage('')
            setErr('')
        }
    }, [value, setMessage, setErr])

    useEffect(()=>{
        if(delay && value && !timeoutAlert) {
            // Activer timeout
            setTimeoutAlert(setTimeout(()=>setValue(''), delay))
        }
    }, [value, setValue, timeoutAlert, setTimeoutAlert, delay])

    useEffect(()=>{
        if(!message && timeoutAlert) {
            // Desactiver timeout
            clearTimeout(timeoutAlert)
            setTimeoutAlert('')
        }
    }, [message, timeoutAlert, setTimeoutAlert, delay])

    return (
        <Alert show={message?true:false} variant={variant} onClose={closeCb} dismissible>
            <Alert.Heading>{titre}</Alert.Heading>
            {message}
            <ShowStackTrace show={afficherStack} afficherStackCb={afficherStackCb} err={err} />
        </Alert>
    )
}

function ShowStackTrace(props) {
    const { err, show, afficherStackCb } = props

    if(!err) return ''

    if(err && !show) return (
        <Row><Col><Button variant="secondary" onClick={afficherStackCb}>Detail</Button></Col></Row>
    )

    let stack = ''
    if(err.stack) {
        console.debug("Stack : %O", err.stack)
        stack = (
            <div>
                <p>{''+err}</p>
                <pre>{err.stack}</pre>
            </div>
        )
    } else {
        stack = <p>{''+err}</p>
    }

    return (
        <div>
            <p>Stack trace</p>
            <pre className="stack">{stack}</pre>
        </div>
    )
}

export function ModalAttente(props) {

    const show = props.show,
          setAttente = props.setAttente

    const [timerOuverture, setTimerOuverture] = useState()
    const [actif, setActif] = useState(false)

    useEffect(()=>{
        if(show && !timerOuverture) {
            setTimeout(()=>setActif(true), 250)
        } else if(!show && timerOuverture) {
            clearTimeout(timerOuverture)
            setTimerOuverture(null)
        }
    }, [timerOuverture, setTimerOuverture, show, setActif])

    useEffect(()=>{
        if(!show && actif) {
            setActif(false)
        }
    }, [actif, show, setActif])

    return (
        <Modal show={actif}>
            <Modal.Header>En cours...</Modal.Header>
            <Modal.Footer>
                <Button disabled={!setAttente} variant="secondary" onClick={()=>setAttente(false)}>Annuler</Button>
            </Modal.Footer>
        </Modal>
    )

}