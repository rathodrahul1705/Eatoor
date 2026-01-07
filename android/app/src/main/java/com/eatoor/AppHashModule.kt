package com.eatoor.apphash

import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import com.facebook.react.bridge.*
import java.security.MessageDigest

class AppHashModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppHash"

    @ReactMethod
    fun getAppHash(promise: Promise) {
        try {
            val packageName = reactContext.packageName
            val pm = reactContext.packageManager

            val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val packageInfo = pm.getPackageInfo(
                    packageName,
                    PackageManager.GET_SIGNING_CERTIFICATES
                )
                val signingInfo = packageInfo.signingInfo  // <-- CAN BE NULL
                signingInfo?.apkContentsSigners            // <-- SAFE CALL
            } else {
                @Suppress("DEPRECATION")
                val packageInfo = pm.getPackageInfo(
                    packageName,
                    PackageManager.GET_SIGNATURES
                )
                packageInfo.signatures
            }

            if (signatures == null || signatures.isEmpty()) {
                promise.reject("NO_SIGNATURE", "No signatures found")
                return
            }

            val signature = signatures[0].toCharsString()
            val appInfo = "$packageName $signature"

            val md = MessageDigest.getInstance("SHA-256")
            md.update(appInfo.toByteArray())

            val hash = Base64.encodeToString(md.digest(), Base64.NO_PADDING or Base64.NO_WRAP)
                .substring(0, 11)

            promise.resolve(hash)

        } catch (e: Exception) {
            promise.reject("ERR_APP_HASH", e.message)
        }
    }
}