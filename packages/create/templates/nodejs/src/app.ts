import { __CLASS__ } from '__PACKAGE__'

const app = new __CLASS__()

app.get('/', (c) => c.text('__CLASS__!'))

export default app
