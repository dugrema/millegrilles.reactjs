import React from 'react'
import Container from 'react-bootstrap/Container'

import styles from './styles.module.css'

export default props => {
    console.debug("Container proppys : %O", props)

    const children = props.children || []

    const haut = children.filter?children.filter(item=>item.type.name!=='FooterApplication'):children
    const bas = children.filter?children.filter(item=>item.type.name==='FooterApplication'):''

    return (
        <div className={styles['flex-wrapper']}>
            <div className={styles['application-layout']}>
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
            <Container>
                {props.children}
            </Container>
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
