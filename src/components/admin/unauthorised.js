import React from 'react';
import { Link } from 'react-router-dom';

const Unauthorized = () => {
    return (
        <div>
            <p>401 - Unauthorised</p>
            <p>You do not have access to this page. Please contact your administrator</p>
            <p><Link to='/'>Back to Home</Link></p>
        </div>
    )
  }
  
  export default Unauthorized;