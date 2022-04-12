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
        this.transport.sendMail({ from: 'cse370-hci-social-apps@buffalo.edu', to, subject, text }, () => {
            if (process.env.NODE_ENV !== 'production') {
                console.log(`Email sent!\n\tTo: ${JSON.stringify(to)}\n\tSubject: ${subject}\n\tMessage: ${text}`);
            }
        });
    }
}
