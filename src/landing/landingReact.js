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

    const { dispatch, actif, progres, preparation } = props

    const variant = props.variant || 'info'

    const show = useMemo(()=>{
        if(progres || preparation) return true
        return false
    })

    useEffect(()=>{
        if(!dispatch || progres !== 100) return
        if(actif) return
        setTimeout(()=>{
            dispatch(clearUploadsState())
        }, 300)
    }, [progres, dispatch, actif, clearUploadsState])
    
    const child = useMemo(()=>{
        if(preparation) {
            return (
                <div>
                  <p>Preparation upload : {preparation}%</p>
                </div>
            )
        }
    
        if(progres === 100) {
            return (
                <div>
                    <p>Upload termine</p>
                </div>
            )
        } else if(progres) {
            return (
                <div>
                    <p>Progres upload : {progres}%</p>
                </div>
            )   
        }

        return ''
    }, [preparation, progres])

    return (
        <Alert variant={variant} show={show}>
            {child}
        </Alert>
    )

}