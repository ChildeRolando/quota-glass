using System;
using System.Runtime.InteropServices;
class GlassHelper {
  [StructLayout(LayoutKind.Sequential)] struct Accent { public int State, Flags; public uint Color; public int Animation; }
  [StructLayout(LayoutKind.Sequential)] struct Data { public int Attribute; public IntPtr Pointer; public int Size; }
  [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left,Top,Right,Bottom; }
  [DllImport("user32.dll")] static extern int SetWindowCompositionAttribute(IntPtr window,ref Data data);
  [DllImport("user32.dll")] static extern int SetWindowRgn(IntPtr window,IntPtr region,bool redraw);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window,out Rect rect);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint processId);
  [DllImport("gdi32.dll")] static extern IntPtr CreateRoundRectRgn(int left,int top,int right,int bottom,int width,int height);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr obj);
  [DllImport("gdi32.dll")] static extern IntPtr CreateRectRgn(int left,int top,int right,int bottom);
  [DllImport("gdi32.dll")] static extern bool PtInRegion(IntPtr region,int x,int y);
  [DllImport("user32.dll")] static extern int GetWindowRgn(IntPtr window,IntPtr region);
  [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr window,int message,IntPtr wparam,IntPtr lparam);
  [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr window,int attr,ref int value,int size);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] static extern IntPtr GetWindowLongPtr(IntPtr h,int index);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h,uint command);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr GetProp(IntPtr h,string name);
  static bool Above(IntPtr first,IntPtr second){for(int n=0;n<4096&&first!=IntPtr.Zero;n++){first=GetWindow(first,2);if(first==second)return true;}return false;}
  static bool Topmost(IntPtr h){return (GetWindowLongPtr(h,-20).ToInt64()&8)!=0;}
  static int Main(string[] args) {
    try {
      if(args.Length<2)return 2;
      IntPtr window=new IntPtr(long.Parse(args[0]));uint expected=uint.Parse(args[1]),owner;
      GetWindowThreadProcessId(window,out owner);if(owner!=expected)return 3;
      SetProcessDpiAwarenessContext(new IntPtr(-4));
      if(args.Length==5 && args[2]=="--stackcheck"){
        bool pinned=args[3]=="true";IntPtr other=new IntPtr(long.Parse(args[4]));uint otherOwner;
        GetWindowThreadProcessId(other,out otherOwner);if(otherOwner!=expected)return 3;
        if(Topmost(window)!=pinned)return 10;
        if(Topmost(other))return 15;
        IntPtr host=GetProp(window,"QuotaGlass.Backdrop");if(host==IntPtr.Zero)return 11;uint hostOwner;GetWindowThreadProcessId(host,out hostOwner);
        if(System.Diagnostics.Process.GetProcessById((int)hostOwner).ProcessName!="GlassBackdrop")return 11;
        if(Topmost(host)!=pinned)return 12;
        bool correct=Above(window,host)&&(pinned?Above(host,other):Above(other,window));
        if(!correct)Console.Error.WriteLine("Native stacking order mismatch; otherTopmost="+Topmost(other));
        return correct?0:14;
      }
      Rect rect;if(!GetWindowRect(window,out rect))return 4;
      int width=rect.Right-rect.Left,height=rect.Bottom-rect.Top;
      if(args.Length==3 && args[2]=="--hitcheck") {
        foreach(var point in new double[][]{new double[]{.29,.395},new double[]{.86,.9}}){
          int x=rect.Left+(int)(width*point[0]),y=rect.Top+(int)(height*point[1]);
          long packed=((y&65535)<<16)|(x&65535);
          if(SendMessage(window,0x84,IntPtr.Zero,new IntPtr(packed)).ToInt64()!=1)return 8;
        }
        return 0;
      }
      if(args.Length==3 && args[2]=="--edgecheck") {
        int x=rect.Right-2,y=rect.Top+height/2;
        long packed=((y&65535)<<16)|(x&65535);
        return SendMessage(window,0x84,IntPtr.Zero,new IntPtr(packed)).ToInt64()==11?0:9;
      }
      if(args.Length==3 && args[2]=="--check") {
        IntPtr probe=CreateRectRgn(0,0,0,0);
        try {return GetWindowRgn(window,probe)>0 && !PtInRegion(probe,0,0) && !PtInRegion(probe,10,10) && PtInRegion(probe,width/2,height/2)?0:7;}
        finally {DeleteObject(probe);}
      }
      // Cut the actual HWND, so no native rectangular backdrop can survive the CSS corners.
      int diameter=(int)Math.Round(height*152.0/414.0);
      int noBorder=unchecked((int)0xfffffffe),square=1,backdropNone=1;
      DwmSetWindowAttribute(window,34,ref noBorder,4);
      DwmSetWindowAttribute(window,33,ref square,4);
      DwmSetWindowAttribute(window,38,ref backdropNone,4);
      // Disable full-window materials. A separately clipped Composition visual owns blur.
      Accent accent=new Accent {State=0,Flags=0,Color=0,Animation=0};
      IntPtr pointer=Marshal.AllocHGlobal(Marshal.SizeOf(accent));
      try {
        Marshal.StructureToPtr(accent,pointer,false);
        Data data=new Data {Attribute=19,Pointer=pointer,Size=Marshal.SizeOf(accent)};
        if(SetWindowCompositionAttribute(window,ref data)==0)return 6;
        // Apply the region last: changing composition can rebuild the native surface.
        IntPtr region=CreateRoundRectRgn(0,0,width+1,height+1,diameter,diameter);
        if(SetWindowRgn(window,region,true)==0){DeleteObject(region);return 5;}
        return 0;
      } finally {Marshal.FreeHGlobal(pointer);}
    } catch {return 1;}
  }
}
