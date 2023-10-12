import React, { useEffect, useState } from 'react';
import './sidebar.css';

let _isMounted = false;

const Sidebar = props => {
    useEffect(()  => {
        _isMounted = true;
        return () => { _isMounted = false };
    });

    return (
        <div className="sidebar-wrapper">
            <div className="sidebar-header p-3">
                <h1>{props.currCategory}</h1>
            </div>
            <div className="sidebar-menu-options">
                {/* Generate sidebar using props from header */}
                {
                    props.options.map(function(data, i) {
                        // Match title to nav link ternary conditional - set active
                        return <a key={i} className="nav-link active" id={"v-pills-" + i + "-tab"} href={"#v-pills-"+i} role="tab" aria-controls={"#v-pills-"+i} aria-selected="true">{data}</a>
                    })
                }
            </div>
        </div>
    )
  }
  
  export default React.forwardRef((props, ref) => <Sidebar innerRef={ref} {...props} />);