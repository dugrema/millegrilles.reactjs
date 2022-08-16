import React from 'react'
import Button from 'react-bootstrap/Button'

export function BoutonActif(props) {

    const { variant, className, onClick, children, etat, icone } = props
    let disabled = props.disabled

    let iconConfirmation = null, 
        etatClassname = ''+etat

    switch(etat) {
        case 'attente':
            iconConfirmation = <i className='fa fa-spinner fa-spin fa-lg' />
            disabled = true
            break
        case 'succes': iconConfirmation = <i className='fa fa-check-circle fa-lg' />; break
        case 'echec': iconConfirmation = <i className='fa fa-times-circle fa-lg' />; break
        default:
            if(icone) iconConfirmation = icone
            else iconConfirmation = <i className="fa fa-arrow-right fa-lg" />
    }

    return (
        <Button 
            variant={variant}
            className={className + ' bouton-actif ' + etatClassname} 
            onClick={onClick} 
            disabled={disabled}>
                {children}{iconConfirmation}
        </Button>
    )
}