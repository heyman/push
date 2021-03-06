import { android as androidApp, launchEvent, on } from '@nativescript/core/application';
import { MessagingOptions, PushNotificationModel } from './messaging';

declare const com;

let _launchNotification = null;
// let _senderId: string = null;

// function getSenderId(): Promise<string> {
//     return new Promise((resolve, reject) => {
//         if (_senderId !== null) {
//             resolve(_senderId);
//         }

//         const setSenderIdAndResolve = () => {
//             const senderIdResourceId = application.android.context
//                 .getResources()
//                 .getIdentifier('gcm_defaultSenderId', 'string', application.android.context.getPackageName());
//             if (senderIdResourceId === 0) {
//                 throw new Error(
//                     "####################### Seems like you did not include 'google-services.json' in your project! Firebase Messaging will not work properly. #######################"
//                 );
//             }
//             _senderId = application.android.context.getString(senderIdResourceId);
//             resolve(_senderId);
//         };

//         if (!application.android.context) {
//             // throw new Error("Don't call this function before your app has started.");
//             application.on(application.launchEvent, () => setSenderIdAndResolve());
//         } else {
//             setSenderIdAndResolve();
//         }
//     });
// }

async function initPushMessaging(options?: MessagingOptions) {
    if (!options) {
        return;
    }
    if (options.showNotificationsWhenInForeground !== undefined) {
        com.nativescript.push.PushMessagingService.showNotificationsWhenInForeground = options.showNotificationsWhenInForeground;
    }
    if (options.onMessageReceivedCallback !== undefined) {
        await addOnMessageReceivedCallback(options.onMessageReceivedCallback);
    }
    if (options.onPushTokenReceivedCallback !== undefined) {
        await addOnPushTokenReceivedCallback(options.onPushTokenReceivedCallback);
    }
}
export function init() {
    if (!androidApp.context) {
        // throw new Error("Don't call this function before your app has started.");
        on(launchEvent, onAppModuleLaunchEvent);
    } else {
        onAppModuleLaunchEvent();
    }
}

export function onAppModuleLaunchEvent() {
    com.nativescript.push.PushMessagingLifecycleCallbacks.registerCallbacks(androidApp.nativeApp);
}

export function onAppModuleResumeEvent(args: any) {
    const intent = args.android.getIntent();
    const extras = intent.getExtras();

    if (extras !== null && extras.keySet().contains('from')) {
        const result = {
            foreground: false,
            data: {},
        };

        const iterator = extras.keySet().iterator();
        while (iterator.hasNext()) {
            const key = iterator.next();
            if (key !== 'from' && key !== 'collapse_key') {
                result[key] = extras.get(key);
                result.data[key] = extras.get(key);
            }
        }

        // clear, otherwise the next resume we trigger this again
        intent.removeExtra('from');

        if (_receivedNotificationCallback === null) {
            _launchNotification = result;
        } else {
            // add a little delay just to make sure clients alerting this message will see it as the UI needs to settle
            setTimeout(() => {
                _receivedNotificationCallback(result);
            });
        }
    }
}

export function registerForInteractivePush(model?: PushNotificationModel): void {
    console.error("'registerForInteractivePush' is not currently implemented on Android");
}

export function getCurrentPushToken(): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            resolve(com.nativescript.push.PushMessagingService.getCurrentPushToken());
        } catch (ex) {
            console.log('Error in messaging.getCurrentPushToken: ' + ex);
            reject(ex);
        }
    });
}

let _receivedNotificationCallback;
function addOnMessageReceivedCallback(callback) {
    return new Promise((resolve, reject) => {
        try {
            _receivedNotificationCallback = callback;

            com.nativescript.push.PushMessagingService.setOnNotificationReceivedCallback(
                new com.nativescript.push.PushMessagingServiceListener({
                    success: (notification) => callback(JSON.parse(notification)),
                    error: (err) => console.log('Error handling message: ' + err),
                })
            );

            // if the app was launched from a notification, process it now
            if (_launchNotification !== null) {
                callback(_launchNotification);
                _launchNotification = null;
            }

            resolve();
        } catch (ex) {
            console.log('Error in messaging.addOnMessageReceivedCallback: ' + ex);
            reject(ex);
        }
    });
}

function addOnPushTokenReceivedCallback(callback) {
    return new Promise((resolve, reject) => {
        try {
            let tokenReturned = false;
            com.nativescript.push.PushMessagingService.setOnPushTokenReceivedCallback(
                new com.nativescript.push.PushMessagingServiceListener({
                    success: (token) => {
                        tokenReturned = true;
                        callback(token);
                    },
                    error: (err) => console.log('addOnPushTokenReceivedCallback error: ' + err),
                })
            );

            // make sure we return a token if we already have it
            // setTimeout(() => {
            //     if (!tokenReturned) {
            //         getSenderId().then((senderId) => {
            //             com.nativescript.push.PushMessagingService.getCurrentPushToken(
            //                 senderId,
            //                 new com.nativescript.push.PushMessagingServiceListener({
            //                     success: (token) => callback(token),
            //                     error: (err) => console.log(err),
            //                 })
            //             );
            //         });
            //     }
            // }, 2000);

            resolve();
        } catch (ex) {
            console.log('Error in messaging.addOnPushTokenReceivedCallback: ' + ex);
            reject(ex);
        }
    });
}

export async function registerForPushNotifications(options?: MessagingOptions): Promise<void> {
    // return new Promise((resolve, reject) => {
    // try {
    await initPushMessaging(options);

    return new Promise((resolve, reject) => {
        com.nativescript.push.PushMessagingService.registerForPushNotifications(
            new com.nativescript.push.PushMessagingServiceListener({
                success: (token) => resolve(token),
                error: (err) => reject(err),
            })
        );
    });

    // getSenderId()
    //     .then((senderId) => {
    //         com.nativescript.push.PushMessagingService.registerForPushNotifications(senderId);
    //         resolve();
    //     })
    //     .catch((e) => reject(e));
    // } catch (ex) {
    //     console.log('Error in messaging.registerForPushNotifications: ' + ex);
    //     reject(ex);
    // }
    // });
}

export function unregisterForPushNotifications(): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            if (typeof com.google.firebase.messaging === 'undefined') {
                reject("Uncomment firebase-messaging in the plugin's include.gradle first");
                return;
            }

            com.nativescript.push.PushMessagingService.unregisterForPushNotifications();
            // getSenderId().then((senderId) => com.nativescript.push.PushMessagingService.unregisterForPushNotifications(senderId));

            resolve();
        } catch (ex) {
            console.log('Error in messaging.unregisterForPushNotifications: ' + ex);
            reject(ex);
        }
    });
}

export function subscribeToTopic(topicName) {
    return new Promise((resolve, reject) => {
        try {
            const onCompleteListener = new com.google.android.gms.tasks.OnCompleteListener({
                onComplete: (task) => {
                    if (task.isSuccessful()) {
                        resolve();
                    } else {
                        reject(
                            task.getException() && task.getException().getReason
                                ? task.getException().getReason()
                                : task.getException()
                        );
                    }
                },
            });

            com.google.firebase.messaging.FirebaseMessaging.getInstance()
                .subscribeToTopic(topicName)
                .addOnCompleteListener(onCompleteListener);
        } catch (ex) {
            console.log('Error in messaging.subscribeToTopic: ' + ex);
            reject(ex);
        }
    });
}

export function unsubscribeFromTopic(topicName) {
    return new Promise((resolve, reject) => {
        try {
            const onCompleteListener = new com.google.android.gms.tasks.OnCompleteListener({
                onComplete: (task) => {
                    if (task.isSuccessful()) {
                        resolve();
                    } else {
                        reject(
                            task.getException() && task.getException().getReason
                                ? task.getException().getReason()
                                : task.getException()
                        );
                    }
                },
            });

            com.google.firebase.messaging.FirebaseMessaging.getInstance()
                .unsubscribeFromTopic(topicName)
                .addOnCompleteListener(onCompleteListener);
        } catch (ex) {
            console.log('Error in messaging.unsubscribeFromTopic: ' + ex);
            reject(ex);
        }
    });
}

export function areNotificationsEnabled() {
    return androidx.core.app.NotificationManagerCompat.from(androidApp.context).areNotificationsEnabled();
}
