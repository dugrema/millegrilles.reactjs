import React from 'react'
import moment from 'moment-timezone'
import momentDurationFormatSetup from "moment-duration-format"
momentDurationFormatSetup(moment)  // Activer plugin

const CONST_KB = 1024,
      CONST_MB = CONST_KB*1024,
      CONST_GB = CONST_MB*1024,
      CONST_TB = CONST_GB*1024,
      CONST_PB = CONST_TB*1024

const CONST_DATE_DEFAULT = 'YYYY/MM/DD',
      CONST_DATETIME_DEFAULT = 'YYYY/MM/DD HH:mm:ss',
      CONST_DATEMONTHHOUR_DEFAULT = 'MMM-DD HH:mm:ss',
      CONST_TIMEZONE_DEFAULT  = 'America/Toronto'

export function FormatteurTaille(props) {
    const value = props.value
    const precision = props.precision || 3
  
    if(!value) return ''

    let result, unit;
    if(value > CONST_TB) {
        result = (value/CONST_PB).toPrecision(precision);
        unit = 'Tb';
    } else if(value > CONST_TB) {
        result = (value/CONST_TB).toPrecision(precision);
        unit = 'Tb';
    } else if(value > CONST_GB) {
        result = (value/CONST_GB).toPrecision(precision);
        unit = 'Gb';
    } else if(value > CONST_MB) {
        result = (value/CONST_MB).toPrecision(precision);
        unit = 'Mb';
    } else if(value > CONST_KB) {
        result = (value/CONST_KB).toPrecision(precision);
        unit = 'kb';
    } else {
        result = value;
        unit = 'bytes';
    }

    const label = result + ' ' + unit

    return <span>{label}</span>
}

export function FormatterDate(props) {
    const format = props.format || CONST_DATETIME_DEFAULT,
          timezone = props.timezone || CONST_TIMEZONE_DEFAULT

    const value = props.value

    return moment(value*1000).tz(timezone).format(format)
}

export function FormatterDuree(props) {
    const { value } = props
    const momentDuree = moment.duration(value, 'seconds')
    console.debug("Moment duree : %O", momentDuree)
    return momentDuree.format('h:mm:ss')
}
