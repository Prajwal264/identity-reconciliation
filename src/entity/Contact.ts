import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

/*
 * Table: Contact
 *
 * id Int
 * phoneNumber String?
 * email String?
 * linkedId Int? // the ID of another Contact linked to this one
 * linkPrecedence "secondary"|"primary" // "primary" if it's the first Contact in th
 * createdAt DateTime
 * 
 */
@Entity()
/* Wouldn't choose to add these many indexes ideally, but anyway */
@Index("emailIndex", ["email", "linkPrecedence", "createdAt"], { sparse: true })
@Index("phoneNumberIndex", ["phoneNumber", "linkPrecedence", "createdAt"], { sparse: true })
export class Contact {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  phoneNumber: string | null;

  @Column({ nullable: true })
  email: string | null;

  @Index({ sparse: true })
  @Column({ nullable: true })
  linkedId: number | null;

  @Column({})
  linkPrecedence: string;

  @Column({ type: 'timestamp' })
  createdAt: Date;

  @Column({type: "timestamp" })
  updatedAt: Date;
}
