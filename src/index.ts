import { app } from './server';
import { loadConfig } from './config/load-config';

const { port } = loadConfig();
app.listen(port, () => console.log('Central Service listening on port ' + port));
