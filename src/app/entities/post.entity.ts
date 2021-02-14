import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { User } from './user.entity';
import { getDateTimeType } from '../utils';

@Entity()
export class Post extends BaseEntity {

  @PrimaryGeneratedColumn({ name: 'post_id' })
  id: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'post_author_id' })
  author: User;

  @CreateDateColumn({
    name: 'post_created',
    type: getDateTimeType(),
    // Our mariadb os old enough that multiple CURRENT_TIMESTAMPs cause an issue...
    default: () => 0
    //default: () => "CURRENT_TIMESTAMP"
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'post_updated',
    type: getDateTimeType(),
    // For some reason mariadb doesn't like what typeorm does by default, CURRENT_TIMESTAMP(6)
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP"
  })
  updatedAt: Date;

  @Column({ name: 'post_type' })
  type: string;

  @Column({ name: 'post_content' })
  content: string;

  @Column({ name: 'post_thumbnail'})
  thumbnailURL: string;

  @ManyToOne(() => Post, post => post.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_parent_id' })
  parent: Post;

  @OneToMany(() => Post, post => post.parent)
  children: Post[];

  commentCount: number;

}
