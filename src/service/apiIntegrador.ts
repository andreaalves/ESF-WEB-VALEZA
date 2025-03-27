import axios from 'axios';

const apiIntegrador = axios.create({
  baseURL: 'https://esf-api-valeza.up.railway.app',
});
export default apiIntegrador;
