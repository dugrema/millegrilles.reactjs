import React from 'react'
import Container from 'react-bootstrap/Container'

import styles from './styles.module.css'

export default props => {
    const children = props.children || []

    const haut = children.filter?children.filter(item=>item.type.name!=='FooterApplication'):children
    const bas = children.filter?children.filter(item=>item.type.name==='FooterApplication'):''

    return (
        <div className={styles.flexwrapper}>
            <div className={styles.applicationlayout}>
                {haut}
            </div>
            {bas}
        </div>
    )
}

export function HeaderApplication(props) {
    
    const className = styles.header

    return (
        <div className={className}>
            {props.children}
        </div>
    )
}

export function FooterApplication(props) {

    const className = styles.footer

    return (
        <div className={className}>
            <Container>
                {props.children}
            </Container>
        </div>
    )
}

export function IconeConnexion(props) {
    const {connecte} = props
    let stylesConnexion = []
    if(connecte) {
        stylesConnexion = [styles.connecte, "fa fa-"]
    } else {
        stylesConnexion = [styles.deconnecte, "fa fa-plug"]
    }
    return <i className={stylesConnexion.join(' ')} />
}