import { __CLASS__ } from '__PACKAGE__'
import { aboutPage } from './page.tsx'

const app = new __CLASS__()

app.get('/', (c) => c.text('__CLASS__!'))

app.get('/about', (c) => c.html(aboutPage()))

export default app
