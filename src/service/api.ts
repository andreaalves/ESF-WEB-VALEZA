import axios from 'axios';

const api = axios.create({
  baseURL: 'https://esf-api-valeza.up.railway.app',
});
export default api;
