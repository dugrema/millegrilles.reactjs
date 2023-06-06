import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'

import { clearUploadsState } from './uploaderSlice'

export function BoutonUpload(props) {

    const { traitementFichiers, dispatch, setPreparationUploadEnCours, signalAnnuler, token, batchId, errCb } = props
  
    const refUpload = useRef()
  
    const [className, setClassName] = useState('')
  
    const handlerPreparationUploadEnCours = useCallback(event=>{
        console.debug('handlerPreparationUploadEnCours ', event)
        setPreparationUploadEnCours(event)
    }, [setPreparationUploadEnCours])
  
    const upload = useCallback( acceptedFiles => {
        console.debug("Files : %O pour correlationSubmitId: %s, signalAnnuler: %O", acceptedFiles, batchId, signalAnnuler)
        
        handlerPreparationUploadEnCours(0)  // Debut preparation
  
        traitementFichiers.traiterAcceptedFiles(
            dispatch, 
            {acceptedFiles, token, batchId}, 
            {signalAnnuler, setProgres: handlerPreparationUploadEnCours}
        )
            .then(()=>{
                // Pass
            })
            .catch(err=>{
                console.error("BoutonUpload Erreur upload fichiers : %O", err)
                if(errCb) errCb({err, message: 'Erreur traiter fichiers'})
            })
            .finally( () => handlerPreparationUploadEnCours(false) )
  
    }, [handlerPreparationUploadEnCours, traitementFichiers, dispatch, token, batchId])
  
    const fileChange = event => {
        event.preventDefault()
        setClassName('')
  
        const acceptedFiles = event.currentTarget.files
        upload(acceptedFiles)
    }
  
    const onButtonDrop = event => {
        event.preventDefault()
        setClassName('')
  
        const acceptedFiles = event.dataTransfer.files
        upload(acceptedFiles)
    }
  
    const handlerOnDragover = event => {
        event.preventDefault()
        setClassName('dropping')
        event.dataTransfer.dropEffect = "move"
    }
  
    const handlerOnDragLeave = event => { event.preventDefault(); setClassName(''); }
  
    const handlerOnClick = event => {
        refUpload.current.click()
    }
  
    return (
        <div 
            className={'upload ' + className}
            onDrop={onButtonDrop}
            onDragOver={handlerOnDragover} 
            onDragLeave={handlerOnDragLeave}
          >
            <Button 
                variant="secondary" 
                className="individuel"
                onClick={handlerOnClick}
                disabled={!token}
              >
                {props.children}
            </Button>
            <input
                id='file_upload'
                type='file' 
                ref={refUpload}
                style={{display: 'none'}}
                multiple
                onChange={fileChange}
              />
        </div>
    )
}

export function ProgresUpload(props) {

    const { actif, progres, preparation } = props

    const variant = props.variant || 'info'

    const show = useMemo(()=>{
        if(preparation || actif) return true
        return false
    }, [preparation, actif])
    
    const child = useMemo(()=>{

        const etat = []

        if(preparation) {
            etat.push(<p key={'preparation'}>Preparation upload : {Math.floor(preparation/10)}%</p>)
        }
    
        if(progres === 100) {
            etat.push(<p key={'upload'}>Upload termine</p>)
        } else if(progres) {
            etat.push(<p key={'progres'}>Upload en cours : {Math.floor(9*progres/10+10)}%</p>)
        }

        return etat
    }, [preparation, progres])

    return (
        <Alert variant={variant} show={show}>
            {child}
        </Alert>
    )

}