import { Injectable } from '@angular/core';
import {Observable} from "rxjs/index";
import {J4careHttpService} from "./helpers/j4care-http.service";
import {AppService} from "./app.service";
import {j4care} from "./helpers/j4care.service";
import {forkJoin, of} from "rxjs";
import {catchError, combineLatest, map, switchMap} from "rxjs/operators";
import {HttpClient} from "@angular/common/http";
import * as _ from 'lodash-es';
import {DcmWebApp} from "./models/dcm-web-app";
import {environment} from "../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class AppRequestsService {
    private _dcm4cheeArcConfig;
    baseUrl;
    get dcm4cheeArcConfig() {
        return this._dcm4cheeArcConfig;
    }

    set dcm4cheeArcConfig(value) {
        this._dcm4cheeArcConfig = value;
    }

    constructor(
      private $http:J4careHttpService,
      private appService:AppService,
      public $httpClient:HttpClient
    ) { }

    getServerTime(url?:string){
        return this.$http.get(`${url ? j4care.addLastSlash(url) : j4care.addLastSlash(this.appService.baseUrl)}monitor/serverTime`)
    }

    getPDQServices(url?:string):Observable<any[]>{
        return this.$http.get(`${url ? j4care.addLastSlash(url) : j4care.addLastSlash(this.appService.baseUrl)}pdq`)
    }

    getDeviceName(){
        return this.getDcm4cheeArc();
    }
    getDeviceInfo(dicomDeviceName:string, url?:string){
        return this.$http.get(`${url ? j4care.addLastSlash(url) : j4care.addLastSlash(this.appService.baseUrl)}devices?dicomDeviceName=${dicomDeviceName}`)
    }

    getDeviceNameFromURL(url){
      return this.$http.get(`${url}/devicename`).pipe(
          catchError(error => {
              return of({dicomDeviceName:"NOT_FOUND"})
          })
      );
    }
    getDcm4cheeArc(){
        let tempDcm4cheeArch;
        if(this._dcm4cheeArcConfig){3
            return of(this._dcm4cheeArcConfig);
        }else{
            return this.$httpClient.get("./rs/dcm4chee-arc").pipe(
                map(dcm4cheeArc=>{
                    if(!environment.production){
                        dcm4cheeArc["dcm4chee-arc-urls"] = [
                            "http://shefki-lifebook:8080/dcm4chee-arc",
                            "http://192.168.0.111:8080/dcm4chee-arc"
                        ];
                    }
                    tempDcm4cheeArch = dcm4cheeArc;
                    if(_.hasIn(dcm4cheeArc, "dcm4chee-arc-urls[0]")){
                        this.baseUrl = _.get(dcm4cheeArc, "dcm4chee-arc-urls[0]");
                        this.appService.baseUrl = this.baseUrl;
                    }
                    return dcm4cheeArc;
                }),
                switchMap(dcm4cheeArc=>{
                    let services:Observable<any>[] = _.get(dcm4cheeArc, "dcm4chee-arc-urls").map(url=>{
                        return this.getDeviceNameFromURL(url).pipe(catchError(error => of(error)));
                    });
                    return forkJoin(services);
                }),
                map(res=>{
                    try{
                        let deviceNameUrlMap = {};
                        tempDcm4cheeArch["dcm4chee-arc-urls"].forEach((url:any,i)=>{
                            deviceNameUrlMap[url] = _.get(res,`${i}.dicomDeviceName`);
                            if(!environment.production){
                                if(i === 1)
                                    deviceNameUrlMap[url] = `stowrsd`;
                            }
                            if(i > 0){
                                tempDcm4cheeArch["hasMoreThanOneBaseUrl"] = true;
                            }
                        });
                        tempDcm4cheeArch["deviceNameUrlMap"] = deviceNameUrlMap;

                    }catch(e){

                    }
                    this._dcm4cheeArcConfig = tempDcm4cheeArch;
                    this.appService.dcm4cheeArcConfig = tempDcm4cheeArch;
                    return tempDcm4cheeArch;
                }),
                catchError(err=>{
                    return err;
                })
            );
        }
    }
    getMyDevice(){
        if(_.hasIn(this.appService.global,"myDevice")){
            return of(this.appService.global.myDevice);
        }else{
            let deviceName;
            let archiveDeviceName;
            return this.getDcm4cheeArc()
                .pipe(
                    switchMap(res => {
                        deviceName = (_.get(res,"UIConfigurationDeviceName") || _.get(res,"dicomDeviceName"));
                        archiveDeviceName = _.get(res,"dicomDeviceName");
                        return this.$httpClient.get(`${j4care.addLastSlash(this.baseUrl)}devices/${deviceName}`)
                    }),
                    map((res)=>{
                        try{
                            let global = _.cloneDeep(this.appService.global) || {};
                            global["uiConfig"] = _.get(res,"dcmDevice.dcmuiConfig[0]");
                            global["myDevice"] = res;
                            this.appService.deviceName = deviceName;
                            this.appService.archiveDeviceName = archiveDeviceName;
                            this.appService.setGlobal(global);
                        }catch(e){
                            console.warn("Permission not found!",e);
                            this.appService.showError($localize `:@@permission_not_found:Permission not found!`);
                        }
                        return res;
                    })
                );
        }
    }
    getUiConfig(){
        if(_.hasIn(this.appService.global,"uiConfig")){
            return of(this.appService.global.uiConfig);
        }else{
            return this.getMyDevice().pipe(map(res=>{
                return _.get(res,"dcmDevice.dcmuiConfig[0]");
            }))
        }
    }
    getMyWebApps(){
        if(_.hasIn(this.appService.global,"myDevice")){
            return of((<DcmWebApp[]>_.get(this.appService.global.myDevice,"dcmDevice.dcmWebApp")).map((dcmWebApp:DcmWebApp)=>{
                dcmWebApp.dcmKeycloakClientID = (<any[]>_.get(this.appService.global.myDevice,"dcmDevice.dcmKeycloakClient")).filter(keycloakClient=>{
                    return keycloakClient.dcmKeycloakClientID === dcmWebApp.dcmKeycloakClientID;
                })[0];
                return dcmWebApp;
            }));
        }else{
            return this.getMyDevice().pipe(map(res=>{
                return (<DcmWebApp[]>_.get(res,"dcmDevice.dcmWebApp")).map((dcmWebApp:DcmWebApp)=>{
                    dcmWebApp.dcmKeycloakClientID = (<any[]>_.get(this.appService.global.myDevice,"dcmDevice.dcmKeycloakClient")).filter(keycloakClient=>{
                        return keycloakClient.dcmKeycloakClientID === dcmWebApp.dcmKeycloakClientID;
                    })[0];
                    return dcmWebApp;
                });
            }))
        }
    }
}
