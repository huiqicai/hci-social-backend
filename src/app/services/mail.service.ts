import {createTransport, Transporter} from 'nodemailer';

export class Mail {
    private transport: Transporter;

    constructor() {
        if (process.env.NODE_ENV === 'production') {
            this.transport = createTransport({sendmail: true});    
        } else {
            this.transport = createTransport({jsonTransport: true});
        }
    }

    send(to: string, subject: string, text: string) {
        this.transport.sendMail({ to, subject, text }, (_, {message}) => {
            if (process.env.NODE_ENV !== 'production') {
                const {to, subject, text} = JSON.parse(message);
                console.log(`Email sent!\n\tTo: ${JSON.stringify(to)}\n\tSubject: ${subject}\n\tMessage: ${text}`);
            }
        });
    }
}
