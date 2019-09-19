import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, ToastController, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import * as moment from 'moment';

import { Observable } from 'rxjs';

import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/firestore';
import { AngularFireAuth } from '@angular/fire/auth';
import * as firebase from 'firebase';

import { Post } from '../models/post';

import { CommentsPage } from '../comments/comments.page';

@Component({
    selector: 'app-home',
    templateUrl: 'home.page.html',
    styleUrls: ['home.page.scss']
})
export class HomePage implements OnInit {
    message: string; // 入力されるメッセージ用
    post: Post; // Postと同じデータ構造のプロパティーを指定できる
    posts: Post[]; // Post型の配列という指定もできる
    displayName: string; // ユーザー名を表示する
    uranai: string; // 占い結果



    // Firestoreのコレクションを扱うプロパティー
    postsCollection: AngularFirestoreCollection<Post>;

    // 時刻表示用Ï
    now: Observable<Date>;
    intervalList = [];

    constructor(
        private alertCtrl: AlertController,
        private toastCtrl: ToastController,
        private afStore: AngularFirestore,
        private afAuth: AngularFireAuth,
        private router: Router,
        private modalCtrl: ModalController
    ) {}

    ngOnInit() {
        this.afStore.firestore.enableNetwork();
        // コンポーネントの初期化時に、投稿を読み込むgetPosts()を実行
        this.getPosts();
        // ユーザー名を取得する
        this.displayName = this.afAuth.auth.currentUser.displayName;
        // 時刻表示用
        this.now = new Observable((observer) => {
            this.intervalList.push(setInterval(() => {
              observer.next(new Date());
            }, 1000));
          });
          // 占い
        this.uranai = this.getUranai();
    }
    // tslint:disable-next-line:use-life-cycle-interface
    ngOnDestroy() {
        if (this.intervalList) {
          this.intervalList.forEach((interval) => {
            clearInterval(interval);
          });
        }
    }


    addPost() {
        // 入力されたメッセージを使って、投稿データを作成
        this.post = {
            id: '',
            userName: this.afAuth.auth.currentUser.displayName,
            message: this.message,
            created: firebase.firestore.FieldValue.serverTimestamp()
        };

        // ここでFirestoreにデータを追加する
        this.afStore
            .collection('posts')
            .add(this.post)
            // 成功したらここ
            .then(docRef => {
                // 一度投稿を追加したあとに、idを更新している
                this.postsCollection.doc(docRef.id).update({
                    id: docRef.id
                });
                // 追加できたら入力フィールドを空にする
                this.message = '';
            })
            .catch(async error => {
                // エラーをToastControllerで表示
                const toast = await this.toastCtrl.create({
                    message: error.toString(),
                    duration: 3000
                });
                await toast.present();
            });
    }

    // Firestoreから投稿データを読み込む
    getPosts() {
        // コレクションの参照をここで取得している
        this.postsCollection = this.afStore.collection(
            'posts', ref => ref.orderBy('created', 'desc'));

        // データに変更があったらそれを受け取ってpostsに入れる
        this.postsCollection.valueChanges().subscribe(data => {
            this.posts = data;
        });
    }

    async presentPrompt(post: Post) {
        const alert = await this.alertCtrl.create({
            header: 'メッセージ編集',
            inputs: [
                {
                    name: 'message',
                    type: 'text',
                    placeholder: 'メッセージ'
                }
            ],
            buttons: [
                {
                    text: 'キャンセル',
                    role: 'cancel',
                    handler: () => {
                        console.log('キャンセルが選択されました');
                    }
                },
                {
                    text: '更新',
                    handler: data => {
                        // 投稿を更新するメソッドを実行
                        this.updatePost(post, data.message);
                    }
                }
            ]
        });
        await alert.present();
    }

    // メッセージをアップデートする
    // 更新されると投稿とメッセージを受け取る
    updatePost(post: Post, message: string) {
        // 入力されたメッセージで投稿を更新
        this.postsCollection
            .doc(post.id)
            .update({
                message
            })
            .then(async () => {
                const toast = await this.toastCtrl.create({
                    message: '投稿が更新されました',
                    duration: 3000
                });
                await toast.present();
            })
            .catch(async error => {
                const toast = await this.toastCtrl.create({
                    message: error.toString(),
                    duration: 3000
                });
                await toast.present();
            });
    }

    // 投稿を削除する
    deletePost(post: Post) {
        //  受け取った投稿のidを参照して削除
        this.postsCollection
            .doc(post.id)
            .delete()
            .then(async () => {
                const toast = await this.toastCtrl.create({
                    message: '投稿が削除されました',
                    duration: 3000
                });
                await toast.present();
            })
            .catch(async error => {
                const toast = await this.toastCtrl.create({
                    message: error.toString(),
                    duration: 3000
                });
                await toast.present();
            });
    }

    // 投稿日時と現在日時との差を返す
    differenceTime(time: Date): string {
        moment.locale('ja');
        return moment(time).fromNow();
    }

    // ログアウト処理
    logout() {
        this.afStore.firestore.disableNetwork();
        this.afAuth.auth
            .signOut()
            .then(async () => {
                const toast = await this.toastCtrl.create({
                    message: 'ログアウトしました',
                    duration: 3000
                });
                await toast.present();
                this.router.navigateByUrl('/login');
            })
            .catch(async error => {
                const toast = await this.toastCtrl.create({
                    message: error.toString(),
                    duration: 3000
                });
                await toast.present();
            });
    }

    // コメントページへ現在の投稿を受け渡しつつ移動
    async showComment(post: Post) {
        const modal = await this.modalCtrl.create({
            component: CommentsPage,
            componentProps: {
                sourcePost: post
            }
        });
        return await modal.present();
    }

        // 占い
        getUranai() {
            const ransu = Math.round(Math.random() * 5);
            switch (ransu) {
                case 0:
                    return 'アマガエルと一緒にまったりできるような一日になるでしょう。';
                    break;
                case 1:
                    return 'トノサマガエルのようにどっしりとしているといいでしょう。';
                    break;
                case 2:
                    return 'ヤドクガエル並みに危険なことがあるかもしれません。';
                    break;
                case 3:
                    return 'ツノガエルのように変化のない一日が待っているでしょう。';
                    break;
                case 4:
                    return 'ヒキガエルみたいに嫌われるかもしれません。';
                    break;
                case 5:
                    return 'カメガエルレベルの変な出来事があるかもしれません。';
                    break;
                default:
                    return '';
                    break;
            }
        }

        // 占い結果を表示
        async outputUranai() {
            const toast = await this.toastCtrl.create({
                message: this.uranai,
                buttons: [
                    {
                        text: 'OK',
                        role: 'cancel'
                    }
                ]
            });
            await toast.present();
        }

        async outputUser() {
            const toast = await this.toastCtrl.create({
                message: this.displayName,
                buttons: [
                    {
                        text: 'OK',
                        role: 'cancel'
                    }
                ]
            });
            await toast.present();
        }
}
